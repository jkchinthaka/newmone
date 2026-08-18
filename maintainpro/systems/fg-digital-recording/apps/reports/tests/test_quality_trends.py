"""Quality trend counts from stored data."""

from __future__ import annotations

import pytest
from django.test import Client
from django.urls import reverse

from apps.recording.synthetic_demo import load_synthetic_demo_data


@pytest.mark.django_db
def test_quality_trends_page(client: Client) -> None:
    demo = load_synthetic_demo_data()
    client.force_login(demo.admin)
    response = client.get(reverse("reports:trends"))
    assert response.status_code == 200
    assert b"Quality trends" in response.content
    assert b"Cleaning unacceptable" in response.content
