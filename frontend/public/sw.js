self.addEventListener('install', (event) => {
});

self.addEventListener('fetch', (event) => {
    // Implement basic fetch handling or caching here
});

self.addEventListener('push', function (event) {
    const title = 'Space Mission Tracker';
    const options = {
        body: event.data ? event.data.text() : 'A launch event is updating!',
    };
    event.waitUntil(self.registration.showNotification(title, options));
});