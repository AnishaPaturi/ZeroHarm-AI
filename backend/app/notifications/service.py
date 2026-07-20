import sqlite3
from datetime import datetime

from app.database import get_connection


class NotificationService:

    def create_notification(self, title, message, category, severity):
        conn = get_connection()

        conn.execute(
            """
            INSERT INTO notifications
            (title, message, category, severity, created_at, is_read)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                title,
                message,
                category,
                severity,
                datetime.now().isoformat(),
                0,
            ),
        )

        conn.commit()
        conn.close()

    def get_notifications(self):
        conn = get_connection()

        cursor = conn.execute(
            """
            SELECT *
            FROM notifications
            ORDER BY created_at DESC
            """
        )

        rows = cursor.fetchall()

        conn.close()

        return [dict(row) for row in rows]

    def unread_count(self):
        conn = get_connection()

        cursor = conn.execute(
            """
            SELECT COUNT(*)
            FROM notifications
            WHERE is_read = 0
            """
        )

        count = cursor.fetchone()[0]

        conn.close()

        return count

    def mark_as_read(self, notification_id):
        conn = get_connection()

        conn.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE id = ?
            """,
            (notification_id,),
        )

        conn.commit()
        conn.close()

   


notification_service = NotificationService()