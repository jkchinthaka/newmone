"""Abstract foundation mixins — no concrete business tables."""

from __future__ import annotations

from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Timezone-aware created/updated timestamps for future concrete models."""

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ActiveFlagModel(models.Model):
    """Soft active/inactive flag for future concrete models."""

    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
