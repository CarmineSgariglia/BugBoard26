from drf_spectacular.extensions import OpenApiAuthenticationExtension


class RevocableJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.bugboardapi.security.authentication.RevocableJWTAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }


class CSRFAwareSessionAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.bugboardapi.security.authentication.CSRFAwareSessionAuthentication"
    name = "csrfToken"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "X-CSRFToken",
        }
