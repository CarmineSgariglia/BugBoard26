import random

from django.contrib.auth.models import User

from apps.bugboardapi.models import Issue, Notification, NotifyType, NotifyUser, Project

def seed_notifications():
    # Find active admin user or fallback
    user = User.objects.filter(profile__active=True).first()
    if not user:
        print("No user found to send notifications to.")
        return

    # Try to find some projects or issues for the context
    projects = list(Project.objects.all()[:5])
    issues = list(Issue.objects.all()[:5])

    print(f"Creating 5 notifications for user: {user.username}")

    for i in range(5):
        notify_type = random.choice([t[0] for t in NotifyType.choices])
        
        # Depending on type, assign either project or issue
        project = None
        issue = None
        
        if notify_type in [NotifyType.PROJECT_ADDED, NotifyType.PROJECT_REMOVED]:
            if projects:
                project = random.choice(projects)
        else:
            if issues:
                issue = random.choice(issues)
            elif projects:
                # Project fallback if no issues but type expects issue (just to bypass constraints if needed)
                # Actually constraints say XOR project/issue.
                # So if type is issue related but we have no issues, pick an issue-related project? No, constraint is strictly issue OR project.
                # Let's just create an issue if none exist.
                if not issues and projects:
                    issue = Issue.objects.create(
                        project=projects[0],
                        reporter=user,
                        title="Dummy Issue for Notification",
                        description="Created by seeder"
                    )
                    issues.append(issue)

        # Ensure we have a target
        if not project and not issue:
            if projects:
                project = projects[0]
            else:
                project = Project.objects.create(name=f"Dummy Project {i}", created_by=user)
                projects.append(project)
                
            notify_type = NotifyType.PROJECT_ADDED

        notif = Notification.objects.create(
            notify_type=notify_type,
            project=project,
            issue=issue
        )
        
        NotifyUser.objects.create(
            notification=notif,
            user=user,
            is_read=False
        )
        print(f"Created {notify_type} notification.")

seed_notifications()
