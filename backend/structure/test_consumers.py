from django import test

from . import consumers

class ConsumerTestCase(test.SimpleTestCase):
    def test_diff_equal(self):
        data, update = consumers.diff(
            {
                'key1': [1, 2, 3],
                'key2': {
                    'subkey1': False,
                },
            },
            {
                'key1': [1, 2, 3],
                'key2': {
                    'subkey1': False,
                },
            },
        )
        self.assertEqual(update, False)
        self.assertEqual(data, None)

    def test_diff_not_equal(self):
        data, update = consumers.diff(
            {
                'key1': [1, 2, 3],
                'key2': {
                    'subkey1': False,
                    'subkey2': False,
                },
            },
            {
                'key1': [1, 2, 3],
                'key2': {
                    'subkey1': None,
                    'subkey2': False,
                },
            },
        )
        self.assertEqual(update, {
            'key2': {
                'subkey1': True,
            },
        })
        self.assertEqual(data, {
            'key2': {
                'subkey1': None,
            },
        })
