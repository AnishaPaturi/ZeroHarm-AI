import os
import json
import uuid
import asyncio
import logging
from typing import Dict, Any, List, Optional
from collections import deque
from datetime import datetime

logger = logging.getLogger("zeroharm_ai.integration.ingestion_queue")

# Optional imports for real message brokers
try:
    import pika
    HAS_PIKA = True
except ImportError:
    HAS_PIKA = False

try:
    from confluent_kafka import Producer, Consumer
    HAS_KAFKA = True
except ImportError:
    HAS_KAFKA = False


class TelemetryStreamProcessor:
    """
    Implements Option B: Stream Processing (Apache Flink / Spark Streaming style Sliding Windows).
    Maintains in-memory rolling windows for telemetry variables (CO, pressure, etc.) and
    computes aggregations (moving averages, slope/rate of change, variance/standard deviation).
    Triggers alarms or synthetic anomaly alerts when stream window thresholds are breached.
    """
    def __init__(self, window_size: int = 10):
        self.window_size = window_size
        # Maps zone_name -> metric_name -> deque of values
        self.windows: Dict[str, Dict[str, deque]] = {}
        # Thresholds for stream alerts
        self.thresholds = {
            "co_ppm": {"avg": 35.0, "variance": 15.0},
            "pressure_psi": {"avg": 120.0, "variance": 20.0},
            "h2s_ppm": {"avg": 10.0, "variance": 5.0}
        }

    def process_telemetry(self, zone_name: str, gas_readings: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Ingests a new telemetry event into the sliding windows and computes rolling metrics.
        Returns a list of synthetic anomaly events generated from stream analysis.
        """
        if zone_name not in self.windows:
            self.windows[zone_name] = {
                "co_ppm": deque(maxlen=self.window_size),
                "pressure_psi": deque(maxlen=self.window_size),
                "h2s_ppm": deque(maxlen=self.window_size)
            }

        generated_alerts = []
        timestamp = datetime.now().isoformat()

        for metric in ["co_ppm", "pressure_psi", "h2s_ppm"]:
            if metric in gas_readings and gas_readings[metric] is not None:
                val = float(gas_readings[metric])
                self.windows[zone_name][metric].append(val)

                # Compute window stats
                history = list(self.windows[zone_name][metric])
                if len(history) >= 3:
                    avg_val = sum(history) / len(history)
                    variance = sum((x - avg_val) ** 2 for x in history) / len(history)
                    std_dev = variance ** 0.5

                    # Check threshold breaches on the rolling window
                    limits = self.thresholds.get(metric, {})
                    if avg_val > limits.get("avg", 999.0):
                        generated_alerts.append({
                            "zone": zone_name,
                            "event_type": "stream_threshold_breach",
                            "metric": metric,
                            "value": avg_val,
                            "details": f"Rolling window average for {metric} ({avg_val:.2f}) exceeded threshold ({limits.get('avg')})",
                            "timestamp": timestamp
                        })

                    if std_dev > limits.get("variance", 999.0):
                        generated_alerts.append({
                            "zone": zone_name,
                            "event_type": "stream_high_variance",
                            "metric": metric,
                            "value": std_dev,
                            "details": f"Rolling window standard deviation for {metric} ({std_dev:.2f}) indicates volatile spikes",
                            "timestamp": timestamp
                        })
        return generated_alerts


class IngestionQueue:
    """
    Implements Option A: Decoupling with Message Brokers (Kafka / RabbitMQ).
    Acts as the entry point for all sensor telemetry and CCTV events.
    Supports Kafka, RabbitMQ, and falls back to an in-memory asyncio.Queue if brokers are offline.
    """
    def __init__(self, broker_type: str = "asyncio"):
        self.broker_type = broker_type.lower()
        self.queue: asyncio.Queue = asyncio.Queue()
        self.running = False
        self.loop = None
        self.stream_processor = TelemetryStreamProcessor(window_size=10)

        # Connection settings
        self.kafka_servers = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

        # Clients
        self.kafka_producer = None
        self.rabbitmq_channel = None

        logger.info(f"Initializing IngestionQueue with broker type: {self.broker_type}")

    def connect(self):
        """Attempts connection to the configured message broker."""
        if self.broker_type == "rabbitmq" and HAS_PIKA:
            try:
                params = pika.URLParameters(self.rabbitmq_url)
                connection = pika.BlockingConnection(params)
                self.rabbitmq_channel = connection.channel()
                self.rabbitmq_channel.queue_declare(queue="zeroharm_telemetry", durable=True)
                logger.info("Successfully connected to RabbitMQ broker.")
            except Exception as e:
                logger.error(f"Failed to connect to RabbitMQ: {e}. Falling back to in-memory asyncio.Queue.")
                self.broker_type = "asyncio"

        elif self.broker_type == "kafka" and HAS_KAFKA:
            try:
                self.kafka_producer = Producer({"bootstrap.servers": self.kafka_servers})
                logger.info("Successfully connected to Kafka bootstrap servers.")
            except Exception as e:
                logger.error(f"Failed to connect to Kafka: {e}. Falling back to in-memory asyncio.Queue.")
                self.broker_type = "asyncio"

    async def publish_event(self, event_type: str, data: Dict[str, Any]) -> str:
        """
        Publishes an event to the queue/broker and returns a unique Task ID.
        This call is non-blocking (O(1)) and responds immediately to the client.
        """
        task_id = str(uuid.uuid4())
        payload = {
            "task_id": task_id,
            "event_type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }

        # 1. Option B: Pre-process with sliding windows
        if event_type == "state_update":
            zone = data.get("zone_name")
            update_data = data.get("update", {})
            if zone and "gas_readings" in update_data:
                # Analyze sliding windows and trigger synthetic alarms if needed
                alerts = self.stream_processor.process_telemetry(zone, update_data["gas_readings"])
                for alert in alerts:
                    # Enqueue stream alerts as secondary events
                    await self._enqueue_payload({
                        "task_id": f"stream-{uuid.uuid4()}",
                        "event_type": "stream_anomaly",
                        "timestamp": datetime.now().isoformat(),
                        "data": alert
                    })

        # 2. Option A: Enqueue primary payload
        await self._enqueue_payload(payload)
        return task_id

    async def _enqueue_payload(self, payload: Dict[str, Any]):
        """Internal helper to route payload to broker or local queue."""
        if self.broker_type == "rabbitmq" and self.rabbitmq_channel:
            try:
                # Run blocking RabbitMQ publish in threadpool to avoid blocking event loop
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.rabbitmq_channel.basic_publish(
                        exchange="",
                        routing_key="zeroharm_telemetry",
                        body=json.dumps(payload),
                        properties=pika.BasicProperties(delivery_mode=2)  # Make message persistent
                    )
                )
                return
            except Exception as e:
                logger.error(f"RabbitMQ publish failed: {e}. Falling back to local queue.")

        elif self.broker_type == "kafka" and self.kafka_producer:
            try:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.kafka_producer.produce(
                        "zeroharm_telemetry",
                        key=payload["data"].get("zone_name", "general").encode("utf-8"),
                        value=json.dumps(payload).encode("utf-8")
                    )
                )
                return
            except Exception as e:
                logger.error(f"Kafka publish failed: {e}. Falling back to local queue.")

        # Fallback / default: in-memory queue
        await self.queue.put(payload)

    async def start_consumer(self, message_handler_callback):
        """
        Starts the background worker loop that consumes and processes events.
        """
        self.running = True
        self.loop = asyncio.get_running_loop()
        logger.info("Starting background Ingestion Queue consumer daemon...")

        if self.broker_type == "asyncio":
            while self.running:
                try:
                    payload = await self.queue.get()
                    await message_handler_callback(payload)
                    self.queue.task_done()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in in-memory consumer worker: {e}", exc_info=True)
                    await asyncio.sleep(1)

        elif self.broker_type == "rabbitmq":
            # For RabbitMQ, poll the blocking queue using an executor
            while self.running:
                try:
                    method_frame, header_frame, body = await self.loop.run_in_executor(
                        None,
                        lambda: self.rabbitmq_channel.basic_get(queue="zeroharm_telemetry", auto_ack=True)
                    )
                    if method_frame:
                        payload = json.loads(body.decode("utf-8"))
                        await message_handler_callback(payload)
                    else:
                        await asyncio.sleep(0.1)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error in RabbitMQ consumer worker: {e}", exc_info=True)
                    await asyncio.sleep(1)

        elif self.broker_type == "kafka":
            # For Kafka, create a consumer client and poll in executor
            try:
                consumer = Consumer({
                    "bootstrap.servers": self.kafka_servers,
                    "group.id": "zeroharm_processors",
                    "auto.offset.reset": "earliest"
                })
                consumer.subscribe(["zeroharm_telemetry"])
                
                while self.running:
                    msg = await self.loop.run_in_executor(None, lambda: consumer.poll(timeout=0.1))
                    if msg is None:
                        continue
                    if msg.error():
                        logger.error(f"Kafka consumer error: {msg.error()}")
                        continue
                    
                    payload = json.loads(msg.value().decode("utf-8"))
                    await message_handler_callback(payload)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error in Kafka consumer worker: {e}", exc_info=True)


# Global instance reference to import in main.py
ingestion_pipeline = IngestionQueue(
    broker_type=os.getenv("INGESTION_BROKER_TYPE", "asyncio")
)
