import 'https://code.jquery.com/jquery-3.7.1.min.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app-check.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";
import {
	getDatabase,
	runTransaction,
	ref,
	child,
	get,
	set,
	push,
	update,
	query,
	orderByChild,
	equalTo,
	limitToFirst,
	onValue,
	onDisconnect,
	onChildAdded,
	onChildChanged,
	onChildRemoved
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import {
	createUserWithEmailAndPassword,
	getAuth,
	onAuthStateChanged,
	sendEmailVerification,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	signOut,
	checkActionCode,
	applyActionCode,
	verifyPasswordResetCode,
	confirmPasswordReset,
	updateProfile,
	linkWithCredential,
	signInWithPopup,
	GoogleAuthProvider,
	getAdditionalUserInfo
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getPerformance } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-performance.js";
import { getRemoteConfig, getValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-remote-config.js";

import app from './config.js';
import TDialog from './dialog.js';

const appCheck = initializeAppCheck(app, {
	provider: new ReCaptchaEnterpriseProvider('6LemV5EpAAAAAEuKX7BK_enKi_Xxn4DgHbfHh5Tl'),
	isTokenAutoRefreshEnabled: true
});

const analytics = getAnalytics(app);
const messaging = getMessaging(app);
const perf = getPerformance(app);

const database = getDatabase();

const auth = getAuth();
auth.useDeviceLanguage();

const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
remoteConfig.defaultConfig = {
	"app_name": "Tambayan",
	"app_desc": "Hangout with friends."
};

onMessage(messaging, (payload) => {
	const data = payload.data;
	console.log('Message received. ', payload);
});

function getWebToken() {
	getToken(messaging, { vapidKey: 'BHic1OSHI5Gmg4V73K_zNgotDK0kW4w8Ukp-pOquU9HsJGwKYI3KANZUUR6cCI_sK4OPr1aGje3l90UT-gj9D6o' })
		.then((currentToken) => {
			const user = auth.currentUser;
			if (currentToken) {
				update(ref(database, `/users/tokens/${user.uid}`), {
					webFcmToken: currentToken
				});
			} else {
				requestPermission();
			}
		}).catch((err) => {
			console.log('[FCM: An error occurred while retrieving token]: ', err);
		});
}

function requestPermission() {
	Notification.requestPermission().then((permission) => {
		if (permission === 'granted') {
			getWebToken();
		}
	});
}

function getLastPathSegment() {
	const url = new URL(window.location.href);
	return url.pathname.split('/').pop();
}

function toggleLike(uid, id) {
	const postRef = ref(database, `/posts/${id}`);
	runTransaction(postRef, (post) => {
		if (post) {
			if (post.likes && post.likes[uid]) {
				post.likeCount--;
				post.likes[uid] = null;
			} else {
				post.likeCount++;
				if (!post.likes) {
					post.likes = {};
				}
				post.likes[uid] = true;
			}
		}
		return post;
	});
}

function toggleFollow(uid, userId) {
	const userRef = ref(database, `/users/${userId}`);
	runTransaction(userRef, (user) => {
		if (user) {
			if (user.followings && user.followings[uid]) {
				user.followingCount--;
				user.followings[uid] = null;
			} else {
				user.followingCount++;
				if (!user.followings) {
					user.followings = {};
				}
				user.followings[uid] = true;
			}
		}
		addFollowers(userId, uid);
		return user;
	});
}

function addFollowers(uid, userId) {
	const userRef = ref(database, `/users/${userId}`);
	runTransaction(userRef, (user) => {
		if (user) {
			if (user.followers && user.followers[uid]) {
				user.followerCount--;
				user.followers[uid] = null;
			} else {
				user.followerCount++;
				if (!user.followers) {
					user.followers = {};
				}
				user.followers[uid] = true;
			}
		}
		return user;
	});
}

function formatNumber(number) {
	if (number >= 1000) {
		return (number / 1000).toFixed(1) + 'k';
	}
	return number.toString();
}

function scrollTop() {
	document.body.scrollTop = 0;
	document.documentElement.scrollTop = 0;
}

function getTimezone() {
	const dateTimeFormat = new Intl.DateTimeFormat();
	return dateTimeFormat.resolvedOptions().timeZone;
}

function convertUTCToLocal(utcTimestamp, targetTimezone) {
	return new Date(utcTimestamp).toLocaleString('en-US', {
		timeZone: targetTimezone
	});
}

function replaceMentions(postContent) {
	const mentionRegex = /@(\w+)/g;
	const replacedContent = postContent.replace(mentionRegex, `<a href="/user/$1" class="mention font-bold text-blue-600">$&</a>`);
	return replacedContent;
}

function extractLinks(text) {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const links = text.match(urlRegex);
	return links || [];
}

function extractHashtags(text) {
	const hashtagRegex = /#(\w+)/g;
	const hashtags = text.match(hashtagRegex);
	return hashtags || [];
}

function convertLinksAndHashtagToHTML(text) {
	const links = extractLinks(text);
	const textWithLinks = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-600">$1</a>');
	const hashtags = extractHashtags(text);
	const textWithHashtags = textWithLinks.replace(/#(\w+)/g, '<a href="/search?q=$1" class="hashtag font-bold text-blue-600">#$1</a>');
	return replaceMentions(textWithHashtags);
}

function formatTime(time) {
	const local = convertUTCToLocal(time, getTimezone())
	const timestamp = new Date(local);
	return timestamp.toLocaleTimeString([], {
		hour: 'numeric', minute: '2-digit'
	});
}

function formatRelativeTime(serverTimestamp) {
	const serverDate = new Date(serverTimestamp);
	const timeDifference = Date.now() - serverDate.getTime();
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const year = 365 * day;

	if (timeDifference < minute) {
		return 'just now';
	} else if (timeDifference < hour) {
		const minutesAgo = Math.floor(timeDifference / minute);
		return `${minutesAgo}m ago`;
	} else if (timeDifference < day) {
		const hoursAgo = Math.floor(timeDifference / hour);
		return `${hoursAgo}h ago`;
	} else if (timeDifference < year) {
		const daysAgo = Math.floor(timeDifference / day);
		return `${daysAgo}d ago`;
	} else {
		const yearsAgo = Math.floor(timeDifference / year);
		return `${yearsAgo} ${yearsAgo === 1 ? 'yr' : 'yrs'} ago`;
	}
}

function redirect(url) {
	return window.location.href = url;
}

function truncate(str, maxlength) {
	if (str.length > maxlength) {
		return str.slice(0, maxlength - 1) + "... <span class='font-bold text-gray-400'>See more</span>";
	} else {
		return str;
	}
}

function truncate2(str, maxlength) {
	if (str.length > maxlength) {
		return str.slice(0, maxlength - 1) + "...";
	} else {
		return str;
	}
}

function createRipple(event) {
	const button = event.currentTarget;
	const circle = document.createElement("span");
	const diameter = Math.max(button.clientWidth, button.clientHeight);
	const radius = diameter / 2;
	circle.style.width = circle.style.height = `${diameter}px`;
	circle.style.left = `${event.clientX - (button.offsetLeft + radius)}px`;
	circle.style.top = `${event.clientY - (button.offsetTop + radius)}px`;
	circle.classList.add("ripple");
	const ripple = button.getElementsByClassName("ripple")[0];

	if (ripple) {
		ripple.remove();
	}
	button.appendChild(circle);
}

(($) => {

	function createUserAccount(user, provider) {
		const date = new Date($('#ca-birthday').val());
		const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
		const data = {
			firstName: $('#ca-firstName').val(),
			lastName: $('#ca-lastName').val(),
			displayName: provider === 'firebase' ? $('#ca-firstName').val() + ' ' + $('#ca-lastName').val() : user.displayName,
			emailAddress: user.email,
			phoneNumber: 'none',
			userPhoto: 'https://www.pngfind.com/pngs/m/610-6104451_image-placeholder-png-user-profile-placeholder-image-png.png',
			username: 't_' + user.email.replace(emailRegex, '').toLowerCase(),
			verification: 'not_verified',
			followingCount: 0,
			followerCount: 0,
			status: 'active',
			uid: user.uid,
			biodata: {
				bio: 'none',
				collage: 'none',
				currentCity: 'none',
				hometown: 'none',
				occupation: 'none',
				politicalViews: 'none',
				religionViews: 'none',
				school: 'none',
				gender: 10
			},
			birthday: {
				day: date.getDay(),
				month: date.getMonth(),
				year: date.getYear()
			},
			privacy: {
				bio: 'everyone',
				collage: 'everyone',
				currentCity: 'everyone',
				hometown: 'everyone',
				occupation: 'everyone',
				politicalViews: 'everyone',
				religionViews: 'everyone',
				school: 'everyone',
				gender: 'everyone',
				emailAddress: 'everyone',
				phoneNumber: 'everyone'
			},
			settings: {
				profileLockEnabled: false,
				sessionEnabled: false,
				twofaEnabled: false
			}
		}
		const users = ref(database, `/users/${user.uid}`);
		set(users, data)
			.then(() => {
				sendEmailVerification(user)
					.then(() => {
						Swal.fire(`Email verification link was sent to ${email}`, "", "success");
						signOut(auth).then(() => redirect('/'));
					})
					.catch((error) => {
						signOut(auth).then(() => redirect('/'));
					});
			});
	}

	function createPost(user) {
		const key = push(child(ref(database), 'posts')).key;
		const data = {
			postKey: key,
			postBody: $('#post-content').val(),
			postBodyColor: 0,
			postType: 'text',
			postTimestamp: Date.now(),
			tags: 'none',
			uid: user.uid,
			visibility: $('#post-privacy').val(),
			likeCount: 0
		}
		set(ref(database, `/posts/${key}`), data)
			.then(() => {
				setTimeout(() => {
					$('#btn-post').html('Post').removeAttr('disabled');
					$('.create-post-layout').addClass('hidden');
					$('body').removeClass('overflow-y-hidden');
				}, 2000);
			})
			.catch((error) => {
				$('#btn-post').html('Post').removeAttr('disabled');
				new TDialog('An error occured. Please try again.').show();
				console.error('[POST CREATION ERROR]: ', error);
			});
	}

	function posts(posts, user) {
		return $($.parseHTML(
			`<div class="post-card animate__animated animate__fadeIn px-4 pt-4 pb-3 w-full sm:w-auto sm:ms-14 sm:me-14 bg-white dark:bg-gray-900 dark:text-white border-b dark:border-gray-800 sm:border sm:mt-4 sm:rounded-lg border-gray-300" id="${posts.postKey}">
							<div class="flex">
								<img class="w-10 h-10 rounded-full object-cover object-center ring-1 ring-gray-300 me-2" src="${user.userPhoto}" alt="Bordered avatar" />
								<div class="grid gap-0 text-2sm w-full mt-0.5">
									<small class="font-bold">${user.displayName} ${user.verification === 'verified' ? '<i class="ms-1 fa-sharp fa-solid fa-circle-check text-blue-600 text-sm"></i>' : ''}</small>
									<small class="text-gray-600 dark:text-gray-200">${formatRelativeTime(convertUTCToLocal(posts.postTimestamp, getTimezone()))} &bull; <i class="fa-sharp fa-solid fa-earth-asia text-gray-600 dark:text-gray-200"></i></small>
								</div>
								<div class="relative inline-block text-left">
								  <button class="bg-transparent" id="btn-options-${posts.postKey}">
									  <i class="fa-sharp fa-solid fa-ellipsis w-6 h-6 text-gray-800 dark:text-white group-hover:text-gray-600"></i>
								  </button>
								  <div id="dropdown-${posts.postKey}" class="absolute hidden z-10 -ml-48 mt-3 transform px-2 w-48 sm:px-0 lg:ml-0 lg:left-1/2 lg:-translate-x-1/2">
                    <div class="rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 overflow-hidden">
                     <div class="py-1">
                     ${posts.uid === auth.currentUser.uid ?
				'<a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-900">Edit post</a>' +
				'<a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-900">Delete post</a>' :
				'<a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-900">Report post</a>'}
                       <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-900">Copy link</a>
                     </div>
                   </div>
                </div>
                </div>
							</div>
							<div class="post-body px-2 py-2${posts.postBodyColor !== 0 ? 'w-full my-2 h-72 sm:h-96 sm:mb-3 text-center flex items-center justify-center bg-blue-900 text-white' : ''}">
								${truncate(convertLinksAndHashtagToHTML(posts.postBody.replace('\r\n', '<br>').replace('\n', '<br>')), 200)}
							</div>
							${posts.images != null ? '<img class="border border-gray-300 dark:border-gray-800 w-full sm:max-h-96 sm:object-center mb-3 rounded-xl object-cover bg-no-repeat bg-center" src="' + posts.images[0] + '"/>' : ''}
							<div class="post-action flex items-center justify-center grid-cols-3 font-medium">
								<button type="button" class="w-full flex items-center justify-center group" id="btn-like-${posts.postKey}">
									<i class="text-xl fa-sharp ${posts.likes ? posts.likes[auth.currentUser.uid] === true ? 'fa-solid text-blue-600' : 'fa-regular' : 'fa-regular'} fa-heart w-6 animate__animated" id="btn-like-icon-${posts.postKey}"></i>
									<span class="h-6 ms-1" id="btn-like-count-${posts.postKey}">${posts.likeCount ? formatNumber(posts.likeCount) : '0'}</span>
								</button>
								<button type="button" class="w-full flex items-center justify-center group">
									<i class="text-xl fa-sharp fa-regular fa-comment w-6"></i>
									<span class="h-6 ms-1">0</span>
								</button>
								<button type="button" class="w-full flex items-center justify-center group">
									<i class="text-xl fa-sharp fa-regular fa-share-from-square w-6"></i>
									<span class="h-6 ms-1">0</span>
								</button>
							</div>
						</div>`
		));
	}

	function loader() {
		return $($.parseHTML(
			`<svg aria-hidden="true" role="status" class="inline w-4 h-4 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
			  <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
			  <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
		  </svg>`
		));
	}

	function path() {
		return window.location.pathname;
	}

	function changePath(path) {
		return window.history.pushState('', '', path);
	}

	function getFragment() {
		return window.location.hash;
	}

	function handleResetPassword(auth, actionCode, continueUrl, lang) {
		$('.body-layout').html($($.parseHTML(
			`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_completion_progress.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">Please wait</h4>
					  <p class="dark:text-white mt-3">
					    This won\'t take long.
					  </p>
						<svg aria-hidden="true" role="status" style="font-size: 16px;" class="inline w-10 mt-3 text-blue-600 animate-spin mx-auto" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
							<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
						</svg>
				 </div>
				`
		)));

		verifyPasswordResetCode(auth, actionCode).then((email) => {
			const accountEmail = email;
			const newPassword = "...";

			confirmPasswordReset(auth, actionCode, newPassword).then((resp) => {
			}).catch((error) => {
				new TDialog('An error occured. Please try again.').show();
			});
		}).catch((error) => {
			// Invalid or expired action code. Ask user to try to reset the password
			// again.
		});
	}

	function handleRecoverEmail(auth, actionCode, lang) {
		let restoredEmail = null;
		$('.body-layout').html($($.parseHTML(
			`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_completion_progress.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">Please wait</h4>
					  <p class="dark:text-white mt-3">
					    This won\'t take long.
					  </p>
						<svg aria-hidden="true" role="status" style="font-size: 16px;" class="inline w-10 mt-3 text-blue-600 animate-spin mx-auto" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
							<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
						</svg>
				 </div>
				`
		)));
		checkActionCode(auth, actionCode).then((info) => {
			restoredEmail = info['data']['email'];
			return applyActionCode(auth, actionCode);
		}).then(() => {
			sendPasswordResetEmail(auth, restoredEmail).then(() => {
				$('.body-layout').html($($.parseHTML(
					`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_completed_m9ci.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">
						  Reset link sent.
						</h4>
					  <p class="dark:text-white mt-3">
					    Check your email inbox to reset your password.
					  </p>
				 </div>
				`
				)));
			}).catch((error) => {
				$('.body-layout').html($($.parseHTML(
					`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_cancel_re_pkdm.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">
						  Error
						</h4>
					  <p class="dark:text-white mt-3">
					    An error occured. Please try again.
					  </p>
				 </div>
				`
				)));
			});
		}).catch((error) => {
			$('.body-layout').html($($.parseHTML(
				`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_cancel_re_pkdm.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">
						  Error
						</h4>
					  <p class="dark:text-white mt-3">
					    Invalid code or it\'s already expired. Please try again.
					  </p>
				 </div>
				`
			)));
		});
	}

	function handleVerifyEmail(auth, actionCode, continueUrl, lang) {
		$('.body-layout').html($($.parseHTML(
			`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_completion_progress.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">Verifying your email</h4>
					  <p class="dark:text-white mt-3">
					    This won\'t take long.
					  </p>
						<svg aria-hidden="true" role="status" style="font-size: 16px;" class="inline w-10 mt-3 text-blue-600 animate-spin mx-auto" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
							<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
						</svg>
				 </div>
				`
		)));
		applyActionCode(auth, actionCode).then((resp) => {
			$('.body-layout').html($($.parseHTML(
				`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_completed_m9ci.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">
						  Verification completed.
						</h4>
					  <p class="dark:text-white mt-3">
					    You will be automaticaly redirected to a login page.
					  </p>
				 </div>
				`
			)));
			setTimeout(() => redirect('/auth/login'), 2000);
		}).catch((error) => {
			$('.body-layout').html($($.parseHTML(
				`
					<div class="w-full max-h-screen p-5">
					  <img src="/assets/img/undraw_cancel_re_pkdm.svg" class="mx-auto h-52" />
						<h4 class="mt-3 mb-3 dark:text-white text-xl">
						  Verification failed.
						</h4>
					  <p class="dark:text-white mt-3">
					    Invalid code or it\'s already expired. Please try again.
					  </p>
				 </div>
				`
			)));
		});
	}

	let isOpen = false;

	function renderHomePage() {
		$('title').html('Home — Tambayan');
		$('main').html($($.parseHTML(
			`<section class="main-home-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar fixed top-0 z-50 w-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm border-b border-gray-300 dark:border-gray-800 sm:dark:border-gray-800">
					<div class="px-3 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
						  <button aria-controls="sidebar-menu" type="button" class="btn-sidebar inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden focus:outline-none dark:text-gray-400">
                <span class="sr-only">Open sidebar</span>
                <i id="navbar-toggler" class="fa-sharp fa-solid fa-bars w-6 icons"></i>
              </button>
							<div class="flex items-center justify-start rtl:justify-end">
								<a href="/" class="flex md:me-24">
									<span class="self-center text-xl font-semibold madimi-one-regular sm:text-2xl whitespace-nowrap text-blue-600">tambayan</span>
								</a>
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
										<button type="button" class="btn-profile flex text-sm bg-gray-800 rounded-full focus:ring-4 focus:ring-gray-300" aria-expanded="false">
											<span class="sr-only">Open user menu</span>
											<img class="w-8 h-8 navbar-avatar object-cover object-center rounded-full" src="https://flowbite.com/docs/images/people/profile-picture-5.jpg" alt="user photo" />
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>

				<aside id="sidebar-menu" class="fixed top-0 left-0 z-40 h-screen pt-14 border-gray-600 transition-transform -translate-x-full bg-transparent sm:border-gray-200 dark:border-gray-800 sm:translate-x-0 sm:border-e-2" aria-label="Sidebar">
					<div class="h-full relative pt-3 px-3 pb-4 w-64 sm:shadow-none bg-white/30 backdrop-blur-sm dark:bg-gray-900/30">
						<ul class="space-y-3 h-full font-medium">
							<li>
								<button id="sidebar-button-home" class="w-full flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
									<i class="fa-sharp fa-solid fa-house flex-shrink-0 w-5 text-xl text-gray-900 dark:text-white transition duration-75 group-hover:text-blue-600 dark:group-hover:text-gray-100"></i>
									<span class="ms-3">Home</span>
								</button>
							</li>
							<li>
								<button id="sidebar-button-search" class="w-full flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
									<i class="fa-sharp fa-solid fa-magnifying-glass flex-shrink-0 w-5 text-xl text-gray-900 dark:text-white transition duration-75 group-hover:text-blue-600 dark:group-hover:text-gray-100"></i>
									<span class="ms-3">Search</span>
								</button>
							</li>
							<li>
								<button id="sidebar-button-notification" class="w-full flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
									<i class="fa-sharp fa-solid fa-bell flex-shrink-0 w-5 text-xl text-gray-900 dark:text-white transition duration-75 group-hover:text-blue-600 dark:group-hover:text-gray-100"></i>
									<span class="ms-3 text-start w-full">Notifications</span>
									<span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">0</span>
								</button>
							</li>
							<li>
								<button id="sidebar-button-inbox" class="w-full flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group">
									<i class="fa-sharp fa-solid fa-inbox flex-shrink-0 w-5 text-xl text-gray-900 dark:text-white transition duration-75 group-hover:text-blue-600 dark:group-hover:text-gray-100"></i>
									<span class="ms-3 text-start w-full">Messages</span>
									<span class="inline-flex items-center justify-center w-3 h-3 p-3 ms-3 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">0</span>
								</button>
							</li>
						</ul>
						<div class="w-full z-1 grid fixed start-0 bottom-0 px-3 pb-3">
						  <button class="btn-create-post flex items-center justify-center bg-gray-200 hover:bg-gray-300 hover:text-white dark:bg-gray-800 text-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-700 group">
							  Create a new post
						  </button>
						  <button class="btn-signout flex items-center justify-center mt-3 bg-blue-600 text-center p-2 text-gray-900 rounded-lg text-white hover:bg-blue-500 dark:hover:bg-blue-500 group">
							  Signout
						  </button>
						</div>
					</div>
				</aside>
				
				<div id="sidebar-overlay" class="hidden z-30 h-full max-w-full fixed top-0 start-0 bottom-0 end-0">	
				</div>

				<div class="content animate__animated animate__fadeIn animate__delay-2s pb-32 p-4 pt-4 px-0 sm:ml-64 sm:pb-0">
					<div class="p-2 px-0 mt-10">
						<div id="home-layout">
							<div class="text-sm font-medium text-center text-gray-500 border-0 dark:bg-gray-900 dark:text-white">
								<ul class="flex -mb-px" data-tabs-toggle="#default-tab-content" role="tablist">
									<li class="w-full" role="presentation">
										<button class="home-tab inline-block p-4 border-b-2 rounded-t-lg active text-blue-600 border-b-2 border-blue-600" id="home-tab" data-tabs-target="#home" type="button" role="tab" aria-controls="home" aria-selected="false">Home</button>
									</li>
									<li class="w-full" role="presentation">
										<button class="foryou-tab inline-block p-4 border-b-0 rounded-t-lg hover:text-gray-600 hover:border-gray-300" id="foryou-tab" data-tabs-target="#foryou" type="button" role="tab" aria-controls="foryou" aria-selected="false">For you</button>
									</li>
								</ul>
							</div>

							<div id="default-tab-content dark:bg-gray-900">
								<div class="rounded-lg" id="home" role="tabpanel" aria-labelledby="home-tab">
									<div class="post-list">
										<div class="w-full max-h-screen flex items-center justify-center text-center p-5 loading-post">
											<svg aria-hidden="true" role="status" style="font-size: 35px;" class="inline w-10 me-3 mt-32 text-blue-600 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
												<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
											</svg>
										</div>
									</div>
								</div>

								<div class="hidden rounded-lg dark:text-white" id="foryou" role="tabpanel" aria-labelledby="foryou-tab">
									<div class="discover-people sm:ps-14 sm:pe-14">
										<h4 class="font-bold ms-4 me-4 mt-3">Recently joined</h4>
										<div class="overflow-x-auto inline-flex p-4 pt-2 mt-2 people-list w-full">
										</div>
									</div>
								</div>
							</div>
						</div>

						<div id="search-layout" class="mt-8 ms-4 me-4 sm:ps-14 sm:pe-14 dark:bg-gray-900 dark:text-white" style="display: none;">
							<div class="flex items-center">
								<input type="text" class="w-full rounded-xl me-2 h-10 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800" placeholder="Search..." />
								<button class="rounded-xl text-white p-2 bg-blue-600 hover:bg-blue-500">Search</button>
							</div>

							<div class="people mt-3">
								<h4 class="font-bold mb-2">People you may know</h4>
								<div class="search-people-list w-full">
								</div>
							</div>
						</div>
						
						<div id="notification-layout" class="mt-6 ms-4 me-4 sm:ps-14 sm:pe-14 dark:bg-gray-900 dark:text-white" style="display: none;">
							<h4 class="font-bold mb-2">Notifications</h4>
							<div class="notification-list">
							  <div class="notif-empty text-center mt-14 text-gray-600 px-4 dark:text-gray-400">
							    No notifications yet.
							  </div>
							</div>
						</div>
						
						<div id="inbox-layout" class="mt-6 ms-4 me-4 sm:ps-14 sm:pe-14 dark:bg-gray-900 dark:text-white" style="display: none;">
							<h4 class="font-bold mb-2">Messages</h4>
						  <div class="messages-list">
							  <div class="message-empty text-center mt-14 text-gray-600 px-4 dark:text-gray-400">
							    No messages yet.
							  </div>
							</div>
						</div>

					</div>
				</div>
			</section>`)));

		$('.btn-sidebar').click(() => {
			if (isOpen) {
				$('#sidebar-menu').addClass('-translate-x-full');
				$('#sidebar-menu').removeClass('translate-x-0');
				$('#sidebar-overlay').addClass('hidden');
				$('body').removeClass('overflow-y-hidden');
				$('#navbar-toggler').removeClass('fa-xmark');
				$('#navbar-toggler').addClass('fa-bars');
				isOpen = false;
			} else {
				$('#sidebar-menu').removeClass('-translate-x-full');
				$('#sidebar-menu').addClass('translate-x-0');
				$('#sidebar-overlay').removeClass('hidden');
				$('body').addClass('overflow-y-hidden');
				$('#navbar-toggler').removeClass('fa-bars');
				$('#navbar-toggler').addClass('fa-xmark');
				isOpen = true;
			}
		});

		$('#sidebar-overlay').click(() => {
			if (isOpen) {
				$('#sidebar-menu').addClass('-translate-x-full');
				$('#sidebar-menu').removeClass('translate-x-0');
				$('#sidebar-overlay').addClass('hidden');
				$('body').removeClass('overflow-y-hidden');
				$('#navbar-toggler').removeClass('fa-xmark');
				$('#navbar-toggler').addClass('fa-bars');
				isOpen = false;
			}
		});

		$('.home-tab').click(() => {
			$('#home').fadeIn();
			$('#foryou').fadeOut();
			$('.home-tab').addClass('rounded-t-lg active text-blue-600 border-b-2 border-blue-600');
			$('.home-tab').removeClass('hover:text-gray-600 hover:border-gray-300');
			$('.foryou-tab').removeClass('rounded-t-lg active text-blue-600 border-b-2 border-blue-600');
			$('.foryou-tab').addClass('hover:text-gray-600 hover:border-gray-300');
		});

		$('.foryou-tab').click(() => {
			$('#foryou').fadeIn();
			$('#home').fadeOut();
			$('.home-tab').removeClass('rounded-t-lg active text-blue-600 border-b-2 border-blue-600');
			$('.home-tab').addClass('hover:text-gray-600 hover:border-gray-300');
			$('.foryou-tab').addClass('rounded-t-lg active text-blue-600 border-b-2 border-blue-600');
			$('.foryou-tab').removeClass('hover:text-gray-600 hover:border-gray-300');
		});

		function home() {
			$('#home-layout').fadeIn('slow');
			$('#search-layout').fadeOut();
			$('#notification-layout').fadeOut();
			$('#inbox-layout').fadeOut();
			$('#bottom-home-icon').addClass('text-blue-600 active');
			$('#bottom-home-icon').removeClass('text-gray-500');
			$('#bottom-search-icon').addClass('text-gray-500');
			$('#bottom-search-icon').removeClass('text-blue-600 active');
			$('#bottom-notification-icon').addClass('text-gray-500');
			$('#bottom-notification-icon').removeClass('text-blue-600 active');
			$('#bottom-inbox-icon').removeClass('text-blue-600 active');
			$('#bottom-inbox-icon').addClass('text-gray-500');
			$(window).on('popstate', function (event) {
			});
		}

		function search() {
			$('#home-layout').fadeOut();
			$('#search-layout').fadeIn('slow');
			$('#notification-layout').fadeOut();
			$('#inbox-layout').fadeOut();
			$('#bottom-home-icon').removeClass('text-blue-600 active');
			$('#bottom-home-icon').addClass('text-gray-500');
			$('#bottom-search-icon').removeClass('text-gray-500');
			$('#bottom-search-icon').addClass('text-blue-600 active');
			$('#bottom-notification-icon').removeClass('text-blue-600 active');
			$('#bottom-notification-icon').addClass('text-gray-500');
			$('#bottom-inbox-icon').removeClass('text-blue-600 active');
			$('#bottom-inbox-icon').addClass('text-gray-500');
			$(window).on('popstate', function (event) {
				changePath('/');
				home();
			});
		}

		function notifications() {
			$('.navbar').addClass('border-b border-gray-300 dark:border-gray-800');
			$('#home-layout').fadeOut();
			$('#search-layout').fadeOut();
			$('#notification-layout').fadeIn();
			$('#inbox-layout').fadeOut();
			$('#bottom-home-icon').removeClass('text-blue-600 active');
			$('#bottom-home-icon').addClass('text-gray-500');
			$('#bottom-search-icon').addClass('text-gray-500');
			$('#bottom-search-icon').removeClass('text-blue-600 active');
			$('#bottom-notification-icon').removeClass('text-gray-500');
			$('#bottom-notification-icon').addClass('text-blue-600 active');
			$('#bottom-inbox-icon').removeClass('text-blue-600 active');
			$('#bottom-inbox-icon').addClass('text-gray-500');
			$(window).on('popstate', function (event) {
				changePath('/search');
				search();
			});
		}

		function messages() {
			$('.navbar').addClass('border-b border-gray-300 dark:border-gray-800');
			$('#home-layout').fadeOut();
			$('#search-layout').fadeOut();
			$('#notification-layout').fadeOut();
			$('#inbox-layout').fadeIn();
			$('#bottom-home-icon').removeClass('text-blue-600 active');
			$('#bottom-home-icon').addClass('text-gray-500');
			$('#bottom-search-icon').addClass('text-gray-500');
			$('#bottom-search-icon').removeClass('text-blue-600 active');
			$('#bottom-notification-icon').addClass('text-gray-500');
			$('#bottom-notification-icon').removeClass('text-blue-600 active');
			$('#bottom-inbox-icon').removeClass('text-gray-500');
			$('#bottom-inbox-icon').addClass('text-blue-600 active');
			$(window).on('popstate', function (event) {
				changePath('/notifications');
				notifications();
			});
		}

		$('#sidebar-button-home').click(() => {
			$('title').html('Home — Tambayan');
			changePath('/');
			home();
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
		});

		$('#sidebar-button-search').click(() => {
			$('title').html('Search — Tambayan');
			changePath('/search');
			search();
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
		});

		$('#sidebar-button-notification').click(() => {
			$('title').html('Notification — Tambayan');
			changePath('/notifications');
			notifications();
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
		});

		$('#sidebar-button-inbox').click(() => {
			$('title').html('Messages — Tambayan');
			changePath('/messages');
			messages();
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
		});

		onChildAdded(query(ref(database, 'posts', orderByChild('postTimestamp'), limitToFirst(20))), (snapshot) => {
			const post = snapshot.val();
			const uid = post.uid;
			get(ref(database, `/users/${uid}`))
				.then((snapshot) => {
					const user = snapshot.val();

					$('.post-list').prepend(posts(post, user)).fadeIn();
					$(`#btn-like-${post.postKey}`).click(() => toggleLike(auth.currentUser.uid, post.postKey));
					$(`#btn-options-${post.postKey}`).click(() => {
						$(`#dropdown-${post.postKey}`).toggle('hidden');
					});

					$(`#${post.postKey}`).on('click', 'a', (e) => {
						e.preventDefault();
						//
					});

					$('.loading-post').remove().fadeOut('slow');
				}).catch((error) => {
					const name = 'Unknown';
				});
		});

		onChildChanged(ref(database, 'posts'), (snapshot) => {
			const post = snapshot.val();
			const key = snapshot.key;
			$(`#btn-like-count-${key}`).text(formatNumber(post.likeCount));
			if (post.likes && post.likes[auth.currentUser.uid] === true) {
				$(`#btn-like-icon-${key}`).removeClass('fa-regular');
				$(`#btn-like-icon-${key}`).addClass('fa-solid text-blue-600 animate__bounceIn');
			} else {
				$(`#btn-like-icon-${key}`).removeClass('fa-solid text-blue-600 animate__bounceIn');
				$(`#btn-like-icon-${key}`).addClass('fa-regular');
			}
		});

		onChildRemoved(ref(database, 'posts'), (snapshot) => {
			const key = snapshot.key;
			$(`#${key}`).remove().fadeOut();
		});

		onChildAdded(query(ref(database, 'users'), orderByChild('creationTimestamp'), limitToFirst(10)), (snapshot) => {
			const user = snapshot.val();

			if (user.uid !== auth.currentUser.uid) {
				$('.people-list').prepend($($.parseHTML(
					`
					<button id="people-${user.uid}" class="bg-transparent text-center w-20">
						<img class="w-16 h-16 mx-auto rounded-full" src="${user.userPhoto}"/>
						<p class="font-small mt-2 h-5">${truncate2(user.firstName, 16)}</p>
					</button>
				`
				))).fadeIn();
				
				$(`#people-${user.uid}`).click(() => {
					changePath(`/user/${user.username}`);
					renderProfilePage();
				});

				$('.search-people-list').prepend($($.parseHTML(
					`
					<div id="search-${user.uid}" class="inline-flex w-full my-2">
						<img class="rounded-full object-cover w-10 h-10 bg-white" src="${user.userPhoto}"/>
						<div class="p-2 w-full">
						  <p class"mb-2 h-16 me-2 flex w-full">${truncate2(user.displayName, 16)} ${user.verification === 'verified' ? '<i class="ms-1 fa-sharp fa-solid fa-circle-check text-blue-600"></i>' : ''}</p>
						</div>
						<button id="btn-follow-${user.uid}" class="text-white rounded-xl bg-blue-600 hover:bg-blue-500 p-2" style="width: 150px">
						  ${user.followers ? user.followers[auth.currentUser.uid] == true ? 'Unfollow' : 'Follow' : 'Follow'}
						</button>
				  </div>
				`
				))).fadeIn();
				
				$(`#search-${user.uid}`).click(() => {
					changePath(`/user/${user.username}`);
					renderProfilePage();
				});
			}

			$(`#btn-follow-${user.uid}`).click(() => toggleFollow(user.uid, auth.currentUser.uid));
		});

		onChildChanged(ref(database, 'users'), (snapshot) => {
			const user = snapshot.val();
			if (user.followers && user.followers[auth.currentUser.uid] == true) {
				$(`#btn-follow-${user.uid}`).html('Unfollow');
			} else {
				$(`#btn-follow-${user.uid}`).html('Follow');
			}
		});

		const user = auth.currentUser;

		get(ref(database, `/users/${user.uid}`))
			.then((snapshot) => {
				const data = snapshot.val();

				$('.navbar-avatar').attr('src', data.userPhoto);
				if (user.displayName === null && user.photoURL === null) {
					updateProfile(user, {
						displayName: data.displayName,
						photoURL: data.userPhoto
					});
				}

				if (user.photoURL != null && data.userPhoto !== user.photoURL) {
					update(ref(database, `users/${user.uid}`), {
						userPhoto: user.photoURL
					});
				}

				$('.btn-profile').click(() => {
					changePath(`/user/${data.username}`);
					renderProfilePage();
				})
			});

		$('.btn-signout').click(() => {
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
			Swal.fire({
				icon: 'question',
				title: 'Are you sure you want to signout?',
				showDenyButton: true,
				confirmButtonText: 'Signout',
				denyButtonText: 'No',
				showClass: {
					popup: `
                       animate__animated
                       animate__fadeInUp
                       animate__faster
                    `
				},
				hideClass: {
					popup: `
                       animate__animated
                       animate__fadeOutDown
                       animate__faster
                   `
				}
			}).then((result) => {
				if (result.isConfirmed) {
					signOut(auth).then(() => {
						renderLoginPage();
						changePath('/auth/login');
					})
						.catch(() => {
							new TDialog('An error occured. Please try again.').show();
						});
				} else if (result.isDenied) {
					//
				}
			});
		});

		renderCreatePost();
		$('.close-post').click(() => {
			$('.create-post-layout').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
		});
		$('.btn-create-post').click(() => {
			$('body').addClass('overflow-y-hidden');
			$('.create-post-layout').removeClass('hidden');
			$('#sidebar-menu').addClass('-translate-x-full');
			$('#sidebar-menu').removeClass('translate-x-0');
			$('#sidebar-overlay').addClass('hidden');
			$('body').removeClass('overflow-y-hidden');
			$('#navbar-toggler').removeClass('fa-xmark');
			$('#navbar-toggler').addClass('fa-bars');
			isOpen = false;
		});

		$('#btn-post').click(() => {
			if ($('#post-content').val() === '') {
				new TDialog('Post must not be empty.').show();
				return;
			}
			$('#btn-post').html(loader()).attr('disabled', 'true');
			createPost(auth.currentUser);
		});
	}

	function renderProfilePage() {
		$('main').html($($.parseHTML(
			`<section class="profile-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar fixed top-0 z-50 w-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm border-b border-gray-300 dark:border-gray-800 sm:dark:border-gray-800">
					<div class="px-3 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<button type="button" class="btn-back inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden focus:outline-none dark:text-gray-400">
								<span class="sr-only">Open sidebar</span>
								<i id="profile-back-btn" class="fa-sharp fa-solid fa-arrow-left-long w-6 icons"></i>
							</button>
							<div class="flex items-center justify-start rtl:justify-end">
								<span class="flex md:me-24 text-xl font-semibold sm:text-2xl whitespace-nowrap text-gray-900 dark:text-white"></span>
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
										<button type="button" class="flex text-sm">
											<span class="sr-only">Open options</span>
											<i class="fa-sharp fa-solid fa-ellipsis text-gray-600 dark:text-white icons"></i>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>
				
				<div class="profile animate__animated animate__fadeIn p-4 pt-4 px-0 sm:ml-64 sm:pb-0">
				</div>
			</section>`)));

		get(query(ref(database, 'users'), orderByChild('username'), equalTo(getLastPathSegment())))
			.then((snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val();
					snapshot.forEach((user) => {
						$('title').html(`${data[user.key].displayName} - Tambayan`);
						$('.profile').html($($.parseHTML(
							`<div class="profile-page py-1.5 mt-10">
							<div class="profile-cover h-32 bg-blue-900"></div>
							<div class="relative -translate-y-12">
								<div class="px-4 flex justify-between">
									<img src="${data[user.key].userPhoto}" class="rounded-full border border-gray-600 dark:border-gray-800 w-28 h-28" />
									<button class="profile-btn-follow self-end hover:bg-gray-300 dark:hover:bg-gray-700 h-10 mt-15 rounded-xl border border-gray-300 dark:border-gray-800 dark:text-white px-4 py-1.5">${data[user.key].followers ? data[user.key].followers[auth.currentUser.uid] === true ? 'Unfollow' : 'Follow' : data[user.key].uid === auth.currentUser.uid ? 'Edit profile' : 'Follow'}</button>
								</div>
								<h4 class="flex px-4 text-2xl dark:text-white mt-2">${data[user.key].displayName} ${data[user.key].verification === 'verified' ? '<i class="mt-1 ms-2 text-lg fa-sharp fa-solid fa-circle-check text-blue-600"></i>' : ''}</h4>
								<div class="px-4 flex items-start justify-start gap-2">
									<p class="text-gray-600 dark:text-white"><span class="font-bold">${formatNumber(data[user.key].followerCount)}</span> followers</p>
									<p class="text-gray-600 dark:text-white"><span class="font-bold">${formatNumber(data[user.key].followingCount)}</span> followings</p>
								</div>
								${data[user.key].biodata.bio !== null && data[user.key].biodata.bio !== 'none' ?
								'<div class="px-4 py-1 bio">'
								+ '<p class="text-sm text-gray-600 dark:text-white">' + data[user.key].biodata.bio + '</p>' +
								'</div>' : ''}
								${data[user.key].biodata.currentCity !== 'none' ?
								'<div class="mt-2 px-4 flex items-start justify-start gap-2">'
								+ '<span class="text-xs bg-gray-300 rounded-xl px-2 py-1.5 text-gray-600 dark:text-white dark:bg-gray-800"><i class="fa-sharp fa-solid fa-location-dot dark:text-white me-1.5"></i>' + data[user.key].biodata.currentCity + '</span>' +
								'</div>' : ''}
								</div>
								<hr class="mb-2 border-gray-300 dark:border-gray-800">
								<div class="flex justify-between">
								  <h4 class="text-xl px-4 text-gray-600 dark:text-white">Posts</h4>
								</div>
								<hr class="mt-3 mb-3 border-gray-300 dark:border-gray-800">
								<div class="user-post-list">
										<div class="w-full max-h-screen flex items-center justify-center text-center p-5 loading-post">
											<svg aria-hidden="true" role="status" style="font-size: 35px;" class="inline w-10 me-3 mt-3 text-blue-600 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
												<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
											</svg>
										</div>
								</div>
							</div>
						</div>`
						)));

						$('.profile-btn-follow').click(() => {
							if (user.key === auth.currentUser.uid) {
								//
							} else {
								toggleFollow(user.key, auth.currentUser.uid);
							}
						});

						onChildAdded(query(ref(database, 'posts', limitToFirst(20)), orderByChild('uid'), equalTo(user.key)), (snapshot) => {
							const post = snapshot.val();
							if (snapshot.exists()) {
								get(ref(database, `/users/${user.key}`))
								.then((snapshot) => {
									const user1 = snapshot.val();

									$('.user-post-list').prepend(posts(post, user1)).fadeIn();
									$(`#btn-like-${post.postKey}`).click(() => toggleLike(auth.currentUser.uid, post.postKey));
									$(`#btn-options-${post.postKey}`).click(() => {
										$(`#dropdown-${post.postKey}`).toggle('hidden');
									});

									$(`#${post.postKey}`).on('click', 'a', (e) => {
										e.preventDefault();
									});

									$('.loading-post').remove().fadeOut('slow');
								}).catch((error) => {
									console.error(`Load error: `, error.message);
								});
							} else {
								$('.loading-post').remove().fadeOut('slow');
								$('.user-post-list').html('<p class="mt-16 dark:text-white text-center">There\'s no post yet.</p>');
							}
						});

						onChildChanged(ref(database, 'posts'), (snapshot) => {
							const post = snapshot.val();
							const key = snapshot.key;
							$(`#btn-like-count-${key}`).text(formatNumber(post.likeCount));
							if (post.likes && post.likes[auth.currentUser.uid] === true) {
								$(`#btn-like-icon-${key}`).removeClass('fa-regular');
								$(`#btn-like-icon-${key}`).addClass('fa-solid text-blue-600 animate__bounceIn');
							} else {
								$(`#btn-like-icon-${key}`).removeClass('fa-solid text-blue-600 animate__bounceIn');
								$(`#btn-like-icon-${key}`).addClass('fa-regular');
							}
						});

						onChildRemoved(ref(database, 'posts'), (snapshot) => {
							const key = snapshot.key;
							$(`#${key}`).remove().fadeOut();
						});
					});

					onChildChanged(ref(database, 'users'), (snapshot) => {
						const user = snapshot.val();
						if (user.followers && user.followers[auth.currentUser.uid] == true) {
							$(`#profile-btn-follow-${user.uid}`).html('Unfollow');
						} else {
							$(`#profile-btn-follow-${user.uid}`).html('Follow');
						}
					});
				} else {
					$('.profile').html('<p class="mt-32 dark:text-white text-center">User not found.</p>');
				}
			});

		$('.btn-back').click(() => {
			if (auth.currentUser) {
				renderHomePage();
				changePath('/');
			} else {
				renderLoginPage();
				changePath('/auth/login');
			}
		});
	}

	function renderLoginPage() {
		$('title').html('Signin — Tambayan');
		$('main').html($($.parseHTML(
			`<section class="main-login-layout max-h-screen">
				<div class="main-login bg-white dark:bg-gray-900 px-3 p-5">
					<div class="login px-5">
						<h2 class="text-2xl font-bold text-blue-600">Login</h2>
						<p class="text-sm mt-2 text-blue-600">
							To access your Tambayan account.
						</p>
						<div class="login-form mt-6">
							<div>
								<div class="relative">
									<input type="email" name="email" id="email" value="" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 dark:border-gray-600 dark:text-white appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="email" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Email address</label>
								</div>
							</div>

							<div class="mt-4">
								<div class="relative">
									<input type="password" name="password" id="password" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="password" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Password</label>
								</div>
							</div>
							<div class="text-right mt-2">
								<a href="#" class="text-sm font-semibold text-gray-700 dark:text-gray-400 hover:text-blue-700 focus:text-blue-700">
									Forgot Password?</a>
							</div>

							<button type="submit"
								class="btn-login w-full block bg-blue-500 hover:bg-blue-400 focus:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 mt-6">
								Login</button>
						</div>

						<div class="mt-7 grid grid-cols-3 items-center text-gray-500">
							<hr class="border-gray-500" />
							<p class="text-center text-sm">
								OR
							</p>
							<hr class="border-gray-500" />
						</div>
						<button
						  id="signInWithGoogle"
							class="bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300">
							<i class="fa-brands fa-google me-2"></i>
							Signin with Google
						</button>
						<button
							class="bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300 signup-btn">
							Create an account
						</button>
					</div>

					<div class="welcome px-5 hidden">
						<h2 class="text-2xl font-bold text-blue-600">Create an account</h2>
						<p class="text-sm mt-2 text-blue-600">
							Join Tambayan today to discover new friends.
						</p>
						<img class="mt-6" src="/assets/img/undraw_sign_up_n6im.svg" />
						<div class="mt-6">
							<button type="button" class="w-full block bg-blue-500 hover:bg-blue-400 focus:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 mt-6 next-btn-1">Next</button>
						</div>
						<button
							class="go-back-1 bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300">
							Go back
						</button>
					</div>

					<div class="personal-info px-5 hidden">
						<h2 class="text-2xl font-bold text-blue-600">What's your name</h2>
						<p class="text-sm mt-2 text-blue-600">
							Enter your real-life name.
						</p>
						<form class="mt-6" action="#" method="POST">
							<div>
								<div class="relative">
									<input type="text" name="firstNname" id="ca-firstName" value="" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="firstName" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">First name</label>
								</div>
							</div>

							<div class="mt-4">
								<div class="relative">
									<input type="text" name="lastNname" id="ca-lastName" value="" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="lastName" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Last name</label>
								</div>
							</div>
							<button type="button"
								class="w-full block bg-blue-500 hover:bg-blue-400 focus:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 mt-6 next-btn-2">Next</button>
						</form>

						<button
							class="go-back-2 bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300">
							Go back
						</button>
					</div>
					<div class="birthday px-5 hidden">
						<h2 class="text-2xl font-bold text-blue-600">What's your birthday</h2>
						<p class="text-sm mt-2 text-blue-600">
							Enter your real-life birthday.
						</p>
						<div class="mt-6">
							<div class="relative max-w-sm mt-3">
								<div class="absolute inset-y-0 start-0 flex items-center px-3 pointer-events-none">
									<svg class="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor"
										viewBox="0 0 20 20">
										<path
											d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z" />
									</svg>
								</div>
								<input type="date" id="ca-birthday" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full ps-10 p-2.5"
									value="2024-01-01"
									max="2014-12-31" />
							</div>
							<button type="button"
								class="next-btn-3 w-full block bg-blue-500 hover:bg-blue-400 focus:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 mt-6">Next</button>
						</div>
						<button
							class="go-back-3 bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300">
							Go back
						</button>
					</div>
					
					<div class="create-account px-5 hidden">
						<h2 class="text-2xl font-bold text-blue-600">
						 Create your account
						</h2>
						<p class="text-sm mt-2 text-blue-600">
							Enter your email, and password.
						</p>
						<div class="create-account-form mt-6">
							<div>
								<div class="relative">
									<input type="email" name="email" id="ca-email" value="" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 dark:border-gray-600 dark:text-white appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="email" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Email address</label>
								</div>
							</div>

							<div class="mt-4">
								<div class="relative">
									<input type="password" name="password" id="ca-password" class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer" placeholder="" autofocus autocomplete required />
									<label for="password" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">Password</label>
								</div>
							</div>

							<button type="button"
								class="btn-create-account w-full block bg-blue-500 hover:bg-blue-400 focus:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 mt-6">
								  Create account
								</button>
						</div>

						<button
							class="bg-white border px-4 py-3 w-full font-semibold rounded-xl mt-5 flex justify-center items-center text-sm hover:scale-105 duration-300 signup-btn">
							 Go back
						</button>
					</div>

				</div>
			</section>`)));

		$('.btn-login').click(() => {
			if (auth.currentUser) {
				redirect('/');
			} else {
				const email = $('#email').val();
				const password = $('#password').val();
				if (email.length < 4) {
					new TDialog('Email should be 4 and higher.').show();
					return;
				}
				if (password.length < 4) {
					new TDialog('Password should be 4 and higher.').show();
					return;
				}
				$('.btn-login').html(loader()).attr('disabled', 'true');
				signInWithEmailAndPassword(auth, email, password)
					.then((authCredential) => {
						const user = authCredential.user;
						if (user.emailVerified) {
							redirect('/');
						} else {
							Swal.fire({
								icon: "error",
								text: "You must\'ve verify your email.",
								confirmButtonText: 'Resend link'
							})
								.then((result) => {
									if (result.isConfirmed) {
										sendEmailVerification(user)
											.then(() => {
												new TDialog('Email verification link sent.').show();
												signOut(auth);
											});
									} else if (result.isDenied) {
										signOut(auth);
									}
								});
						}
					}).catch((error) => {
						const errorCode = error.code;
						const errorMessage = error.message;
						switch (errorCode) {
							case 'auth/wrong-password':
								new TDialog('Incorrect password.').show();
								break;

							case 'auth/network-request-failed':
								new TDialog('Network error.').show();
								break;

							case 'auth/user-not-found':
								new TDialog('Account does\'t exist.').show();
								break;

							default:
								new TDialog('An error occured. Please try again.').show();
								break;
						}

						console.log('[AUTH]: ', errorMessage);
						$('.btn-login').html(`Login`).removeAttr('disabled');
					});
			}
		});

		$('.btn-create-account').click(() => {
			const email = $('#ca-email').val();
			const password = $('#ca-password').val();
			if (email.length < 4) {
				new TDialog('Email should be 4 and higher.').show();
				return;
			}
			if (password.length < 4) {
				new TDialog('Password should be 4 and higher.').show();
				return;
			}
			$('.btn-create-account').html(loader()).attr('disabled', 'true');
			createUserWithEmailAndPassword(auth, email, password)
				.then((authCredential) => {
					const user = authCredential.user;
					createUserAccount(user, 'firebase');
				})
				.catch((error) => {
					const errorCode = error.code;
					const errorMessage = error.message;
					switch (errorCode) {
						case 'auth/email-already-in-use':
							new TDialog('Email address is already used.').show();
							break;

						case 'auth/network-request-failed':
							new TDialog('Network error.').show();
							break;

						default:
							new TDialog('An error occured. Please try again.').show();
							break;
					}
					$('.btn-create-account').html(`Create account`).removeAttr('disabled');
					console.log(error);
				});
		});

		$('.signup-btn').click(() => {
			renderSignupPage();
			scrollTop();
			changePath('/auth/signup');
		});

		$('.login-btn').click(() => {
			$('.login').removeClass('hidden').fadeIn('slow');
			$('.personal-info').addClass('hidden');
			scrollTop();
			changePath('/auth/login');
		});

		$('.next-btn-1').click(() => {
			$('.welcome').addClass('hidden');
			$('.personal-info').removeClass('hidden');
			scrollTop();
			changePath('/auth/signup#name');
		});

		$('.next-btn-2').click(() => {
			const name = $('#ca-firstName').val();
			const surname = $('#ca-lastName').val();
			if (name === '' || surname === '') {
				new TDialog('Name is required').show();
				return;
			}
			$('.personal-info').addClass('hidden');
			$('.birthday').removeClass('hidden');
			scrollTop();
			changePath('/auth/signup#birthday');
		});

		$('.next-btn-3').click(() => {
			$('.personal-info').addClass('hidden');
			$('.birthday').addClass('hidden');
			$('.create-account').removeClass('hidden');
			scrollTop();
			changePath('/auth/signup#account');
		});

		$('.go-back-1').click(() => {
			$('.login').removeClass('hidden').fadeIn('slow');
			$('.welcome').addClass('hidden');
			scrollTop();
			changePath('/auth/login');
		});

		$('.go-back-2').click(() => {
			renderSignupPage();
			scrollTop();
			changePath('/auth/signup');
		});

		$('.go-back-3').click(() => {
			$('.birthday').addClass('hidden');
			$('.personal-info').removeClass('hidden');
			scrollTop();
			changePath('/auth/signup#name');
		});

		$('#signInWithGoogle').click(() => {
			signInWithPopup(auth, new GoogleAuthProvider())
				.then((result) => {
					const credential = GoogleAuthProvider.credentialFromResult(result);
					const token = credential.accessToken;
					const userInfo = getAdditionalUserInfo(result);
					const user = result.user;

					if (userInfo.isNewUser()) {
						createUserAccount(user, 'google');
					} else {
						redirect('/');
					}
				}).catch((error) => {
					const errorCode = error.code;
					const errorMessage = error.message;
					const email = error.customData.email;
					const credential = GoogleAuthProvider.credentialFromError(error);
					new TDialog(errorMessage).show();
				});
		});
	}

	function renderCreatePost() {
		$('main').append($($.parseHTML(
			`<section class="create-post-layout animate__animated fixed hidden bg-white dark:bg-gray-900 z-50 top-0 start-0 end-0 w-full h-full max-h-screen sm:bg-white sm:h-96 sm:w-96 sm:rounded-xl sm:border sm:mx-auto sm:mt-32 border-gray-300">
				<nav class="navbar top-0 z-50 w-full border-b border-gray-300 dark:bg-gray-900 dark:border-gray-800 sm:border-b-2">
					<div class="px-3 py-2 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<button type="button" class="close-post inline-flex items-center p-2 text-sm text-gray-500 rounded-lg focus:outline-none dark:text-gray-400">
							 <i class="fa-sharp fa-solid fa-xmark text-gray-600 dark:text-gray-200 text-2xl"></i>
							</button>
							<div class="flex items-center justify-start rtl:justify-end">
								<a href="/" class="flex ms-4 md:me-24">
									<span class="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap text-gray-600 dark:text-gray-200">Create post</span>
								</a>
							</div>
							<div class="flex items-center">
								<div class="flex items-center">
									<div>
										<button id="btn-post" type="button" class="w-full flex text-sm bg-blue-600 p-8 py-2 text-white hover:bg-blue-500 rounded-xl" aria-expanded="false">
										  Post
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>
				
				<div class="p-3 mt-2 overflow-y-auto">
				  <div class="flex justify-start mb-1.5">
				    <img class="object-cover rounded-full ring-1 ring-gray-300 dark:ring-gray-800 w-16 h-16 me-2" src="${auth.currentUser.photoURL}"/>
				    <div>
				      <p class="text-xl text-gray-600 dark:text-gray-300">${auth.currentUser.displayName}</p>
				      <select id="post-privacy" class="text-gray-600 dark:text-white border ps-2 py-1.5 border-gray-300 dark:border-gray-800 dark:bg-gray-900 rounded-xl mb-2">
				        <option value="everyone" selected>Everyone</option>
				        <option value="follower_only">Follower only</option>
				        <option value="only_me">Only me</option>
				      </select>
				    </div>
				 </div>
				 <textarea id="post-content" class="w-full border border-gray-300 dark:border-gray-800 dark:text-white dark:bg-gray-900 resize-none h-32 rounded-xl p-4 text-gray-600" placeholder="Write a post..."></textarea>
				 <div class="flex p-2 gap-2 overflow-x-auto">
				   <button class="w-10 h-10 shadow-sm bg-white border border-gray-300 dark:bg-gray-900 dark:border-gray-800 rounded-xl">
				     <span class="sr-only">Background color default</span>
				   </button>
				   <button class="w-10 h-10 shadow-sm bg-blue-900 rounded-xl">
				     <span class="sr-only">Background color blue default</span>
				   </button>
				   <button class="w-10 h-10 shadow-sm bg-blue-700 rounded-xl">
				     <span class="sr-only">Background color blue light</span>
				   </button>
				   <button class="w-10 h-10 shadow-sm bg-red-600 rounded-xl">
				     <span class="sr-only">Background color red</span>
				   </button>
				 </div>
				</div>
			</section>`
		)));
	}

	function renderSignupPage() {
		$('title').html('Signup — Tambayan');
		renderLoginPage();
		$('.login').addClass('hidden');
		$('.welcome').removeClass('hidden').fadeIn('slow');
		scrollTop();
		$(window).on('popstate', function (event) {
			switch (document.location.pathname) {
				case '/auth/login':
					renderLoginPage();
					break;

				case '/auth/signup':
					switch (path() + getFragment()) {
						case '/auth/signup#name':
							renderLoginPage();
							$('.personal-info').removeClass('hidden');
							$('.login').addClass('hidden');
							$('.welcome').addClass('hidden');
							break;
						case '/auth/signup':
							renderSignupPage();
							break;
					}
					break;
			}
		});
	}

	function getParameterByName(name) {
		const queryString = window.location.search;
		const url = new URLSearchParams(queryString);
		return url.get(name);
	}

	$(document).ready(() => {

		const buttons = document.getElementsByTagName("button");
		for (const button of buttons) {
			button.addEventListener("click", createRipple);
		}

		if (navigator.onLine) {
			onAuthStateChanged(auth, (user) => {
				if (user) {
					if (!user.emailVerified) {
						signOut(auth).then(() => {
							renderLoginPage();
							changePath('/auth/login');
						});
					} else {
						getWebToken();
						if (path() === '/') {
							renderHomePage();
						}

						if (path() === '/auth/login') {
							redirect('/');
						}

						if (path() === '/auth/signup') {
							redirect('/');
						}

						if (path() === '/auth') {
							redirect('/');
						}

						if (path() === '/user/' + getLastPathSegment()) {
							renderProfilePage();
						}
					}
				} else {

					if (path() === '/') {
						renderLoginPage();
						changePath('/auth/login');
					}

					if (path() === '/user/' + getLastPathSegment()) {
						renderProfilePage();
					}

					if (path() === '/auth/login') {
						renderLoginPage();
					}

					if (path() === '/auth/signup') {
						renderSignupPage();
					}

					if (path() === '/auth') {
						const mode = getParameterByName('mode');
						const actionCode = getParameterByName('oobCode');
						const continueUrl = getParameterByName('continueUrl');
						const lang = getParameterByName('lang') || 'en';
						$('main').html($($.parseHTML(
							`<section class="main-layout max-h-screen from-slate-50 dark:bg-gray-900">
										<nav class="navbar top-0 z-50 w-full bg-white dark:bg-gray-900 sm:border-b-2 sm:dark:border-gray-800">
											<div class="px-3 py-3 lg:px-5 lg:pl-3">
												<div class="flex items-center justify-between">
													<button aria-controls="sidebar-menu" type="button" class="btn-sidebar inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden focus:outline-none dark:text-gray-400">
													</button>
													<div class="flex items-center justify-start rtl:justify-end">
														<a href="/" class="flex ms-2 md:me-24">
															<span class="self-center text-xl font-semibold madimi-one-regular sm:text-2xl whitespace-nowrap text-blue-600">tambayan</span>
														</a>
													</div>
													<div class="flex items-center">
														<div class="flex items-center ms-3">
															<div>
																<button type="button" class="flex text-sm bg-gray-800 rounded-full focus:ring-4 focus:ring-gray-300" aria-expanded="false">
																</button>
															</div>
														</div>
													</div>
												</div>
											</div>
										</nav>

										<div class="body-layout mt-4 flex items-center justify-center text-center ">
										</div>
									</section>`
						)));
						switch (mode) {
							case 'resetPassword':
								handleResetPassword(auth, actionCode, continueUrl, lang);
								break;
							case 'recoverEmail':
								handleRecoverEmail(auth, actionCode, lang);
								break;
							case 'verifyEmail':
								handleVerifyEmail(auth, actionCode, continueUrl, lang);
								break;
							default:
								$('.body-layout').html($($.parseHTML(
									`
					         <div class="w-full max-h-screen p-5">
					           <img src="/assets/img/undraw_cancel_re_pkdm.svg" class="mx-auto h-52" />
						         <h4 class="mt-3 mb-3 dark:text-white text-xl">
						           Error
						         </h4>
					           <p class="dark:text-white mt-3">
					             Invalid mode.
					           </p>
				           </div>
				          `
								)));
						}
					}
				}
				setTimeout(() => $('.loading').hide().fadeOut(), 2000);
			});
		} else {
			console.error("Network connection is offline.");
		}
	});
})(jQuery);