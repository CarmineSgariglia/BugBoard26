from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IssueViewSet, health_check

router = DefaultRouter()
router.register("issues", IssueViewSet, basename="issues")

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("", include(router.urls)),
]
