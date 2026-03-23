from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers

# This is a simple health check endpoint that can be used to verify that the API is up and running. It can be used by monitoring tools or testing tools like Bruno
@extend_schema(
    tags=["Meta"],
    responses=inline_serializer(
        name="HealthCheckResponse",
        fields={"status": serializers.CharField()},
    ),
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)
