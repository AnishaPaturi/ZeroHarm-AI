from fastapi import APIRouter
from app.notifications.service import notification_service

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)

@router.get("/")
def get_notifications():
    return notification_service.get_notifications()


@router.post("/test")
def create_test_notification():
    notification_service.create_notification(
        title="System Started",
        message="ZeroHarm AI backend is running successfully.",
        category="system",
        severity="info",
    )
    return {"message": "Test notification created"}


@router.patch("/{notification_id}/read")
def mark_notification_as_read(notification_id: int):
    notification_service.mark_as_read(notification_id)
    return {"message": "Notification marked as read"}