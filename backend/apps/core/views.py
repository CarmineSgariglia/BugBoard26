from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Issue
from .serializers import IssueSerializer


@api_view(["GET"])
def health_check(_request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


class IssueViewSet(viewsets.ModelViewSet):
    queryset = Issue.objects.all().order_by("-created_at")
    serializer_class = IssueSerializer
