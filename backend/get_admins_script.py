import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

def get_admins():
    User = get_user_model()
    admins = User.objects.filter(is_superuser=True)
    if not admins.exists():
        print("No superusers found.")
    else:
        for admin in admins:
            print(f"Admin Username: {admin.username}")

if __name__ == "__main__":
    get_admins()
