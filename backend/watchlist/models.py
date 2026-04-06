from django.db import models


class WatchlistEntry(models.Model):
    """A launch saved to a user's watchlist."""
    user = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE, related_name='watchlist_entries'
    )
    launch = models.ForeignKey(
        'launches.Launch', on_delete=models.CASCADE, related_name='watchlist_entries'
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'launch')
        ordering = ['-added_at']

    def __str__(self):
        return f'{self.user.username} → {self.launch.name}'


class MissionLog(models.Model):
    """A personal log entry a user writes about a launch they followed."""
    user = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE, related_name='mission_logs'
    )
    launch = models.ForeignKey(
        'launches.Launch', on_delete=models.CASCADE, related_name='mission_logs'
    )
    title = models.CharField(max_length=256)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username}: {self.title}'


class LaunchPrediction(models.Model):
    """Community prediction: will this launch happen on time?"""
    PREDICTION_CHOICES = [
        ('on_time', 'On Time'),
        ('delayed', 'Will Be Delayed'),
        ('scrubbed', 'Will Be Scrubbed'),
    ]
    launch = models.ForeignKey(
        'launches.Launch', on_delete=models.CASCADE, related_name='predictions'
    )
    user = models.ForeignKey(
        'auth.User', on_delete=models.CASCADE, related_name='predictions'
    )
    prediction = models.CharField(max_length=10, choices=PREDICTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'launch')
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.user.username} → {self.launch.name}: {self.prediction}'
