import { getMessaging } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';
import { onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-sw.js";

import app from './assets/js/config.js';

const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
	const data = payload.data;
	const notificationTitle = data.title === null ? 'Tambayan' : data.title;
	const notificationOptions = {
		body: data.message,
		icon: '/assets/img/logo.png'
	};
	
	self.registration.showNotification(notificationTitle, notificationOptions);
});