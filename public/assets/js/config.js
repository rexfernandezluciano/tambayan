import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

const firebaseConfig = {
	apiKey: "AIzaSyDZ1k4_v0bmNeM4Ez9TFdFO7bt1l1vMOHU",
	authDomain: "itstambayan.web.app",
	databaseURL: "https://tambayan-int-default-rtdb.firebaseio.com",
	projectId: "tambayan-int",
	storageBucket: "tambayan-int.appspot.com",
	messagingSenderId: "116283981319",
	appId: "1:116283981319:web:223518c510d4dd95e1f4a2",
	measurementId: "G-ZJGDFMPRMQ"
};

const app = initializeApp(firebaseConfig);

export default app;