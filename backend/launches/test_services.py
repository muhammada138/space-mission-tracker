import pytest
from launches.services import _parse_launch

def test_parse_launch_valid():
    """Test _parse_launch with a fully populated valid dictionary."""
    data = {
        'id': '12345',
        'name': 'Test Launch',
        'net': '2023-01-01T00:00:00Z',
        'rocket': {
            'configuration': {
                'name': 'Falcon 9'
            }
        },
        'launch_service_provider': {
            'name': 'SpaceX'
        },
        'mission': {
            'description': 'Test Mission',
            'type': 'Communications',
            'orbit': {
                'name': 'LEO'
            }
        },
        'status': {
            'name': 'Success'
        },
        'pad': {
            'name': 'LC-39A',
            'location': {
                'name': 'Kennedy Space Center'
            },
            'latitude': '28.608',
            'longitude': '-80.604'
        },
        'image': 'https://example.com/image.jpg',
        'infographic': 'https://example.com/info.jpg',
        'vidURLs': [
            {'url': 'https://youtube.com/watch?v=123', 'priority': 10}
        ],
        'wiki_url': 'https://en.wikipedia.org/wiki/Falcon_9'
    }

    parsed = _parse_launch(data)

    assert parsed['api_id'] == '12345'
    assert parsed['name'] == 'Test Launch'
    assert parsed['launch_date'] == '2023-01-01T00:00:00Z'
    assert parsed['rocket'] == 'Falcon 9'
    assert parsed['launch_provider'] == 'SpaceX'
    assert parsed['mission_description'] == 'Test Mission'
    assert parsed['mission_type'] == 'Communications'
    assert parsed['orbit'] == 'LEO'
    assert parsed['status'] == 'Success'
    assert parsed['pad_name'] == 'LC-39A'
    assert parsed['pad_location'] == 'Kennedy Space Center'
    assert parsed['pad_latitude'] == 28.608
    assert parsed['pad_longitude'] == -80.604
    assert parsed['image_url'] == 'https://example.com/image.jpg'
    assert parsed['infographic_url'] == 'https://example.com/info.jpg'
    assert parsed['webcast_url'] == 'https://youtube.com/watch?v=123'
    assert parsed['wiki_url'] == 'https://en.wikipedia.org/wiki/Falcon_9'


def test_parse_launch_minimal():
    """Test _parse_launch with the bare minimum required keys."""
    data = {
        'id': '67890'
    }

    parsed = _parse_launch(data)

    assert parsed['api_id'] == '67890'
    assert parsed['name'] == ''
    assert parsed['launch_date'] is None
    assert parsed['rocket'] == ''
    assert parsed['launch_provider'] == ''
    assert parsed['mission_description'] == ''
    assert parsed['mission_type'] == ''
    assert parsed['orbit'] == ''
    assert parsed['status'] == ''
    assert parsed['pad_name'] == ''
    assert parsed['pad_location'] == ''
    assert parsed['pad_latitude'] is None
    assert parsed['pad_longitude'] is None
    assert parsed['image_url'] == ''
    assert parsed['infographic_url'] == ''
    assert parsed['webcast_url'] == ''
    assert parsed['wiki_url'] == ''


def test_parse_launch_invalid_types():
    """Test _parse_launch handling of incorrect data types."""
    data = {
        'id': '11111',
        'mission': 'Not a dictionary',
        'pad': ['Not a dictionary'],
        'vidURLs': 'Not a list'
    }

    parsed = _parse_launch(data)

    assert parsed['api_id'] == '11111'
    assert parsed['mission_description'] == ''
    assert parsed['mission_type'] == ''
    assert parsed['orbit'] == ''
    assert parsed['pad_name'] == ''
    assert parsed['pad_location'] == ''
    assert parsed['pad_latitude'] is None
    assert parsed['pad_longitude'] is None
    assert parsed['webcast_url'] == ''


def test_parse_launch_deeply_nested_missing():
    """Test _parse_launch with deeply nested keys missing."""
    data = {
        'id': '22222',
        'rocket': {}, # Missing 'configuration'
        'launch_service_provider': {}, # Missing 'name'
        'status': {'id': 1}, # Missing 'name'
        'pad': {
            'location': {} # Missing 'name', 'latitude', 'longitude'
        }
    }

    parsed = _parse_launch(data)

    assert parsed['api_id'] == '22222'
    assert parsed['rocket'] == ''
    assert parsed['launch_provider'] == ''
    assert parsed['status'] == ''
    assert parsed['pad_location'] == ''
    assert parsed['pad_latitude'] is None
    assert parsed['pad_longitude'] is None
