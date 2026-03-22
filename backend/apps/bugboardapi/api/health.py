from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

# This is a simple health check endpoint that can be used to verify that the API is up and running. It can be used by monitoring tools or testing tools like Bruno
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)
