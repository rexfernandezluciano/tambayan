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

// const appCheck = initializeAppCheck(app, {
// 	provider: new ReCaptchaEnterpriseProvider('6LemV5EpAAAAAEuKX7BK_enKi_Xxn4DgHbfHh5Tl'),
// 	isTokenAutoRefreshEnabled: true
// });

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
				update(ref(database, `/users/${user.uid}/tokens`), {
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
	const replacedContent = postContent.replace(mentionRegex, `<a href="/u/$1" class="mention font-bold text-blue-600">$&</a>`);
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

function getPath() {
	const parsedUrl = new URL(window.location.href);
	const url = parsedUrl.pathname;
	var segments = url.split('/');
	if (segments.length > 0) {
		return segments[1];
	}
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
				day: (date.getDay() + 1),
				month: (date.getMonth() + 1),
				year: date.getFullYear()
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
								${getPath() === 'p' ? convertLinksAndHashtagToHTML(posts.postBody.replace('\r\n', '<br>').replace('\n', '<br>')) : truncate(convertLinksAndHashtagToHTML(posts.postBody.replace('\r\n', '<br>').replace('\n', '<br>')), 200)}
							</div>
							${posts.images != null ? '<img class="border border-gray-300 dark:border-gray-800 w-full sm:max-h-96 sm:object-center mb-3 rounded-xl object-cover bg-no-repeat bg-center" src="' + posts.images[0] + '"/>' : ''}
							<div class="post-action flex items-center justify-center grid-cols-3 font-medium">
								<button type="button" class="w-full flex items-center justify-center group" id="btn-like-${posts.postKey}">
									<i class="text-xl fa-sharp ${posts.likes ? posts.likes[auth.currentUser.uid] === true ? 'fa-solid text-blue-600' : 'fa-regular' : 'fa-regular'} fa-heart w-6 animate__animated" id="btn-like-icon-${posts.postKey}"></i>
									<span class="h-6 ms-1" id="btn-like-count-${posts.postKey}">${posts.likeCount ? formatNumber(posts.likeCount) : '0'}</span>
								</button>
								<button type="button" class="btn-comment-${posts.postKey} w-full flex items-center justify-center group">
									<i class="text-xl fa-sharp fa-regular fa-comment w-6"></i>
									<span class="comment-count-${posts.postKey} h-6 ms-1">0</span>
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
								  <img src="/assets/img/barkada.png" class="w-10 h-10 "/>
									<span class="hidden self-center text-xl font-semibold madimi-one-regular sm:text-2xl whitespace-nowrap text-blue-600">tambayan</span>
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

					if (user.followers && user.followers[auth.currentUser.uid] === true || uid === auth.currentUser.uid) {
						$('.post-list').prepend(posts(post, user)).fadeIn();
					}
					
					$(`#btn-like-${post.postKey}`).click(() => toggleLike(auth.currentUser.uid, post.postKey));

					$(`#btn-options-${post.postKey}`).click(() => {
						$(`#dropdown-${post.postKey}`).toggle('hidden');
					});

					$(`.comment-count-${post.postKey}`).html(post.comments ? formatNumber(Object.keys(post.comments).length) : '0');

					$(`.btn-comment-${post.postKey}`).click(() => {
						changePath(`/p/${post.postKey}`);
						renderPostCommentPage();
						scrollTop();
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
					changePath(`/u/${user.username}`);
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
					changePath(`/u/${user.username}`);
					renderProfilePage();
					scrollTop();
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
					changePath(`/u/${data.username}`);
					renderProfilePage();
					scrollTop();
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

	function renderWelcomePage() {
		$('title').html('Welcome to Tambayan');
		$('main').html($($.parseHTML(
			`<section class="welcome-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar top-0 z-50 w-full bg-white dark:bg-gray-900">
					<div class="sm:mx-32 px-3 sm:px-0 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
						<div class="sm:hidden"></div>
							<div class="flex items-center justify-center sm:justify-start sm:items-start rtl:justify-end">
							  <img src="/assets/img/barkada.png" class="w-10 h-10"/>
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>
				
				<div class="px-4 sm:px-32 animate__animated animate__fadeIn p-4 pt-4 px-0 sm:pb-0">
				  <div class="sm:flex sm:items-start sm:justify-start">
				   <div class="mt-14 sm:w-96">
				      <p class="text-xs font-bold text-gray-600 dark:text-white">A SOCIAL COMMUNITY NETWORK</p>
				      <p class="text-gray-500 text-3xl dark:text-gray-400 mt-3 mb-3">Welcome to Tambayan</p>
				      <p class="text-gray-500 text-sm dark:text-gray-400">Connect, chat, post, and chill with friends. Join rooms, start conversations, and have fun! 🎉</p>
				      <button class="beta-page text-white px-4 py-1.5 rounded-xl dark:hover:bg-blue-500 hover:bg-gray-300 bg-blue-600 mt-3">Become a member</button>
				      <p class="text-gray-500 text-sm dark:text-gray-400 mt-3">Alreay have an account? <a href="/auth/login" class="text-blue-600 font-semibold hover:text-blue-400">Sign in here</a>.</p>
				    </div>
				    <div class="hidden flex items-end justify-end sm:block mt-14">
				      <img src="/assets/img/barkada.png" class="self-end ms-14 w-72" />
				    </div>
				  </div>
				  <div class="text-center dark:text-white mt-36">
				    <div class="flex items-center justify-center">
				      <ul class="text-xs flex items-center justify-center gap-2">
				        <li><a href="/about" class="dark:text-gray-300 hover:text-blue-600">About</a></li>
				        <li><a href="/privacy-policy" class="dark:text-gray-300 hover:text-blue-600">Privacy Policy</a></li>
				        <li><a href="/terms-of-service" class="dark:text-gray-300 hover:text-blue-600">Terms of Service</a></li>
				      </ul>
				    </div>
				    <span class="text-xs dark:text-gray-400">&copy; 2024 Tambayan. All Rights Reserved.</span>
				  </div>
				</div>
			</section>`
		)));

		$('.beta-page').click(() => {
			changePath('/beta/signup');
			renderBetaPage();
			$(window).on('popstate', function (event) {
				changePath('/');
				renderWelcomePage();
			});
		})
	}

	function renderBetaPage() {
		$('title').html('Beta Access - Tambayan');
		$('main').html($($.parseHTML(
			`<section class="beta-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar top-0 z-50 w-full bg-white dark:bg-gray-900">
					<div class="sm:mx-32 px-3 sm:px-0 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
						<div class="sm:hidden"></div>
							<div class="flex items-center justify-center sm:justify-start sm:items-start rtl:justify-end">
								<img src="/assets/img/barkada.png" class="w-10 h-10"/>
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>
				
				<div class="px-4 sm:px-32 animate__animated animate__fadeIn p-4 pt-4 px-0 sm:pb-0">
				  <div class="sm:flex sm:items-start sm:justify-start">
				   <div class="mt-14 sm:w-96">
				      <p class="text-xs font-bold text-gray-600 dark:text-white">JOIN TO BETA</p>
				      <p class="text-gray-500 text-3xl dark:text-gray-400 mt-3 mb-3">An early access to Tambayan.</p>
				      <p class="text-gray-500 text-sm dark:text-gray-400">Get your access to beta before everyone else. Because beta is the first before it\'s release to the public.</p>
				      <div class="mt-3 border border-gray-300 dark:border-gray-800 flex items-start justify-start rounded-xl">
				        <input type="email" class="beta-email bg-transparent focus:ring-0 ps-3 py-1.5 border-0 dark:text-white w-full" placeholder="Your email" />
				        <button class="beta-signup text-white px-4 py-1.5 rounded-e-xl bg-blue-600 hover:bg-blue-500">Register</button>
				      </div>
				      <p class="text-gray-500 text-sm dark:text-gray-400 mt-3">Alreay have an account? <a href="/auth/login" class="text-blue-600 font-semibold hover:text-blue-400">Sign in here</a>.</p>
				    </div>
				    <div class="hidden flex items-end justify-end sm:block mt-14">
				      <img src="/assets/img/friends.png" class="self-end ms-14 w-72" />
				    </div>
				  </div>
				  <div class="text-center dark:text-white mt-36">
				    <div class="text-center dark:text-white mt-36">
				    <div class="flex items-center justify-center">
				      <ul class="text-xs flex items-center justify-center gap-2">
				        <li><a href="/about" class="dark:text-gray-300 hover:text-blue-600">About</a></li>
				        <li><a href="/privacy-policy" class="dark:text-gray-300 hover:text-blue-600">Privacy Policy</a></li>
				        <li><a href="/terms-of-service" class="dark:text-gray-300 hover:text-blue-600">Terms of Service</a></li>
				      </ul>
				    </div>
				    <span class="text-xs dark:text-gray-400">&copy; 2024 Tambayan. All Rights Reserved.</span>
				  </div>
				</div>
			</section>`
		)));

		$('.beta-signup').click(() => {
			const email = $('.beta-email').val();
			if (email.length < 4) {
				new TDialog('Email should be 4 chars and higher.').show();
				return;
			}
			$('.beta-signup').html(loader()).attr('disabled', 'true');
			get(query(ref(database, 'beta'), orderByChild('email'), equalTo(email)))
				.then((snapshot) => {
					if (snapshot.exists()) {
						$('.beta-signup').html('Register').removeAttr('disabled');
						new TDialog('You\'re already registered to beta.').show();
					} else {
						push(child(ref(database), 'beta'), {
							email: email,
							access: false,
							createdAt: Date.now()
						}).then(() => {
							$('.beta-signup').html('Register').removeAttr('disabled');
							new TDialog('Thanks. You\'ll received a invation link soon.').show();
						}).catch((error) => {
							$('.beta-signup').html('Register').removeAttr('disabled');
							new TDialog('Beta registration isn\'t available at this time.').show();
						});
					}
				});
		});
	}

	function renderProfilePage() {
		$('main').html($($.parseHTML(
			`<section class="profile-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar fixed top-0 z-50 w-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm border-b border-gray-300 dark:border-gray-800 sm:dark:border-gray-800">
					<div class="sm:mx-32 px-3 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<button type="button" class="btn-back inline-flex items-center p-2 text-sm text-gray-500 rounded-lg focus:outline-none dark:text-gray-400">
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
				
				<div class="profile animate__animated animate__fadeIn p-4 pt-4 px-0 sm:pb-0">
				</div>
			</section>`)));

		const username = getLastPathSegment();
		get(query(ref(database, 'users', limitToFirst(1)), orderByChild('username'), equalTo(username)))
			.then((snapshot) => {
				if (snapshot.exists()) {
					const data = snapshot.val();
					snapshot.forEach((user) => {
						$('title').html(`${data[user.key].displayName} - Tambayan`);
						$('.profile').html($($.parseHTML(
							`<div class="profile-page sm:mx-32 py-1.5 mt-10">
							<div class="profile-cover h-32 bg-blue-900"></div>
							<div class="relative -translate-y-12">
								<div class="px-4 flex justify-between">
									<img src="${data[user.key].userPhoto}" class="rounded-full border border-gray-600 dark:border-gray-800 w-28 h-28" />
									<button class="profile-btn-follow-${user.key} self-end hover:bg-gray-300 dark:hover:bg-gray-700 h-10 mt-15 rounded-xl border border-gray-300 dark:border-gray-800 dark:text-white px-4 py-1.5">${auth.currentUser ? data[user.key].uid === auth.currentUser.uid ? 'Edit profile' : data[user.key].followers ? data[user.key].followers[auth.currentUser.uid] === true ? 'Unfollow' : 'Follow' : 'Follow' : 'Follow'}</button>
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

						$(`.profile-btn-follow-${user.key}`).click(() => {
							if (auth.currentUser) {
								if (user.key === auth.currentUser.uid) {
									new TDialog('This feature isn\'t available right now.').show();
								} else {
									toggleFollow(user.key, auth.currentUser.uid);
								}
							} else {
								new TDialog(`Login to follow ${data[user.key].firstName}.`).show();
							}
						});

						if (auth.currentUser) {
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

											$(`.btn-comment-${post.postKey}`).click(() => {
												changePath(`/p/${post.postKey}`);
												renderPostCommentPage();
												scrollTop();
											});

											$(`#${post.postKey}`).on('click', 'a', (e) => {
												e.preventDefault();
											});

											$(`.comment-count-${post.postKey}`).html(post.comments ? formatNumber(Object.keys(post.comments).length) : '0');

											$('.loading-post').remove().fadeOut('slow');
										}).catch((error) => {
											console.error(`Load error: `, error.message);
										});
								} else {
									$('.loading-post').remove().fadeOut('slow');
									$('.user-post-list').html('<p class="mt-8 dark:text-white text-center">There\'s no post yet.</p>');
								}
							});
						} else {
							$('.loading-post').remove().fadeOut('slow');
							$('.user-post-list').html('<p class="mt-8 dark:text-white text-center">Login to see posts here.</p>');
						}

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
							$(`.profile-btn-follow-${user.uid}`).html('Unfollow');
						} else {
							$(`.profile-btn-follow-${user.uid}`).html('Follow');
						}
					});
				} else {
					$('.profile').html('<p class="mt-32 dark:text-white text-center">This profile doesn\'t exist.</p>');
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

		$(window).on('popstate', function (event) {
			changePath('/');
			renderHomePage();
		});
	}

	function renderPostCommentPage() {
		$('title').html('Post - Tambayan');
		$('main').html($($.parseHTML(
			`<section class="comment-post-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar fixed top-0 z-50 w-full bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm border-b border-gray-300 dark:border-gray-800 sm:dark:border-gray-800">
					<div class="sm:mx-32 px-3 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<button type="button" class="btn-back inline-flex items-center p-2 text-sm text-gray-600 dark:text-white rounded-lg focus:outline-none">
								<span class="sr-only">Open sidebar</span>
								<i id="comment-post-back-btn" class="fa-sharp fa-solid fa-arrow-left-long icons"></i>
							</button>
							<div class="flex items-center justify-start rtl:justify-end">
								<span class="flex md:me-24 text-xl font-semibold sm:text-2xl whitespace-nowrap text-gray-900 dark:text-white">Posts</span>
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
										<button type="button" class="flex text-sm">
											<span class="sr-only">Open options</span>
											<i class="fa-sharp fa-solid fa-magnifying-glass text-gray-600 dark:text-white text-lg"></i>
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>
				
				<div class="comment-post relative mt-10 animate__animated animate__fadeIn p-4 pt-4 px-0 sm:pb-0">
				 <div class="sm:px-20 comment-post-holder"></div>
				  <div class="w-full max-h-screen flex items-center justify-center text-center p-5 loading-post">
						<svg aria-hidden="true" role="status" style="font-size: 35px;" class="inline w-10 mx-auto text-blue-600 animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="#E5E7EB" />
							<path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
					  </svg>
					</div>
				</div>
			</section>`)));

		$('.btn-back').click(() => {
			changePath('/');
			renderHomePage();
		});

		$(window).on('popstate', function (event) {
			changePath('/');
			renderHomePage();
		});

		get(ref(database, `/posts/${getLastPathSegment()}`))
			.then((snapshot) => {
				if (snapshot.exists()) {
					const post = snapshot.val();
					$('title').html(`${truncate2(post.postBody, 16)} - Tambayan`);
					get(ref(database, `/users/${post.uid}`))
						.then((snapshot) => {
							const user = snapshot.val();
							$('.comment-post-holder').html(posts(post, user));
							$('.comment-post').append($($.parseHTML(
								`<div class="mt-2">
								  <h4 class="mx-4 sm:mx-32 text-gray-600 dark:text-white text-lg font-semibold">
								    Comments
								  </h4>
								  <div class="px-4 sm:px-32 comment-post-list mt-2 pb-16">
								  </div>
								  <div class="fixed sm:px-32 bottom-0 bg-white dark:bg-gray-900 w-full flex justify-between border-t border-gray-300 dark:border-gray-800 dark:text-white">
								    <input type="text" class="input-comment w-full bg-transparent px-3 py-4 border-0 focus:ring-0" value="" placeholder="Type a comment..." />
								    <button type="button" class="comment-btn bg-transparent text-blue-600 hover:text-blue-500 font-semibold text-md px-2 py-1.5">Send</button>
								  </div>
								</div>`
							)));

							$('.loading-post').remove();

							$(`#btn-like-${post.postKey}`).click(() => toggleLike(auth.currentUser.uid, post.postKey));

							$('.comment-btn').click(() => {
								const comm = $('.input-comment').val();
								if (comm.length > 0) {
									const commKey = push(child(ref(database), `/posts/${post.postKey}/comments`)).key;
									set(ref(database, `/posts/${post.postKey}/comments/${commKey}`), {
										key: commKey,
										postKey: post.postKey,
										text: $('.input-comment').val(),
										timestamp: Date.now(),
										uid: auth.currentUser.uid
									}).then(() => {
										$('.input-comment').val('');
									}).catch((error) => {
										new TDialog('Something when wrong.').show();
									});
								} else {
									new TDialog('Comment cannot be empty.').show();
								}
							});

							$(`.btn-comment-${post.postKey}`).click(() => {
								$('.input-comment').focus();
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

							$(`.comment-count-${post.postKey}`).html(post.comments ? formatNumber(Object.keys(post.comments).length) : '0');
							onChildAdded(query(ref(database, `/posts/${post.postKey}/comments`)), (snapshot1) => {
								if (snapshot1.exists()) {
									const comment = snapshot1.val();
									get(ref(database, `/users/${comment.uid}`))
										.then((snapshot) => {
											$('.comment-post-list').prepend($($.parseHTML(
												`
								         <div class="flex items-start justify-start mb-2">
								           <img class="comment-profile-${comment.key} w-10 h-10 border border-gray-300 dark:border-gray-800 rounded-full me-2" src="${user.userPhoto}"/>
								           <div class="comment-body">
								             <div class="px-2 py-2 rounded-lg bg-gray-800 me-10 text-gray-500 dark:text-gray-100">
								               <h5 class="dark:text-white font-semibold flex items-start justify-start">${user.displayName} ${user.verification === 'verified' ? '<i class="ms-1 fa-sharp fa-solid fa-circle-check text-blue-600 text-md mt-1"></i>' : ''}</h5>
								               ${comment.text}
								             </div>
								             <p class="mt-1.5 text-xs dark:text-gray-100">${formatRelativeTime(comment.timestamp)}</p>
								           </div>
								         </div>`
											)));

											$(`.comment-profile-${comment.key}`).click(() => {
												changePath(`/u/${user.username}`);
												renderProfilePage();
											})
										});
								}
							});
						}).catch((error) => {
							$('.comment-post').html($($.parseHTML(
								`
						     <p class="text-gray-300 dark:text-white px-4 text-center mt-32">
						       ${error.message}
						     </p>`)));
						});
				} else {
					$('.comment-post').html($($.parseHTML(
						`
						<p class="text-gray-300 dark:text-white px-4 text-center mt-32">
						  This post doesn\'t exist or it\'s already removed by the owner.
						</p>
					`)));
				}
			})
			.catch((error) => {
				new TDialog('Something went wrong.').show();
			});
	}

	function renderPrivacyPolicyPage() {
		$('main').html($($.parseHTML(
			`<section class="privacy-policy-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar top-0 z-50 w-full bg-white dark:bg-gray-900">
					<div class="sm:mx-32 px-3 sm:px-0 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<div class="sm:hidden"></div>
							<div class="flex items-center justify-center sm:justify-start sm:items-start rtl:justify-end">
								<img src="/assets/img/barkada.png" class="w-10 h-10" />
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>

				<div class="animate__animated animate__fadeIn px-4 pb-4 sm:px-32 dark:text-white p-4 pt-4 px-0 sm:pb-0">
					<h1 class="text-3xl font-bold">Privacy Policy</h1>
					<p>Last updated: March 14, 2024</p>
					<p class="mt-3">This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.</p>
					<p class="mt-3">We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.</p>
					<h2 class="mt-3 text-2xl font-bold">Interpretation and Definitions</h2>
					<h3 class="mt-3 text-xl font-bold">Interpretation</h3>
					<p class="mt-3">The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.</p>
					<h3 class="mt-3 text-2xl font-bold">Definitions</h3>
					<p class="mt-3">For the purposes of this Privacy Policy:</p>
					<ul class="mt-3">
						<li>
							<p class="ms-16 mt-3"><strong>Account</strong> means a unique account created for You to access our Service or parts of our Service.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Affiliate</strong> means an entity that controls, is controlled by or is under common control with a party, where &quot;control&quot; means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Application</strong> refers to Tambayan, the software program provided by the Company.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Company</strong> (referred to as either &quot;the Company&quot;, &quot;We&quot;, &quot;Us&quot; or &quot;Our&quot; in this Agreement) refers to Tambayan, Inc., General Tinio, Nueva Ecija.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Cookies</strong> are small files that are placed on Your computer, mobile device or any other device by a website, containing the details of Your browsing history on that website among its many uses.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Country</strong> refers to:  Philippines</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Device</strong> means any device that can access the Service such as a computer, a cellphone or a digital tablet.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Personal Data</strong> is any information that relates to an identified or identifiable individual.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Service</strong> refers to the Application or the Website or both.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Service Provider</strong> means any natural or legal person who processes the data on behalf of the Company. It refers to third-party companies or individuals employed by the Company to facilitate the Service, to provide the Service on behalf of the Company, to perform services related to the Service or to assist the Company in analyzing how the Service is used.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Third-party Social Media Service</strong> refers to any website or any social network website through which a User can log in or create an account to use the Service.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Usage Data</strong> refers to data collected automatically, either generated by the use of the Service or from the Service infrastructure itself (for example, the duration of a page visit).</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Website</strong> refers to Tambayan, accessible from <a href="https://itstambayan.web.app" rel="external nofollow noopener" target="_blank">https://itstambayan.web.app</a></p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.</p>
						</li>
					</ul>
					<h2 class="mt-3 text-2xl font-bold">Collecting and Using Your Personal Data</h2>
					<h3 class="mt-3 text-xl font-bold">Types of Data Collected</h3>
					<h4 class="mt-3 text-lg font-bold">Personal Data</h4>
					<p class="mt-3">While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. Personally identifiable information may include, but is not limited to:</p>
					<ul>
						<li>
							<p class="ms-16 mt-3">Email address</p>
						</li>
						<li>
							<p class="ms-16 mt-3">First name and last name</p>
						</li>
						<li>
							<p class="ms-16 mt-3">Phone number</p>
						</li>
						<li>
							<p class="ms-16 mt-3">Address, State, Province, ZIP/Postal code, City</p>
						</li>
						<li>
							<p class="ms-16 mt-3">Usage Data</p>
						</li>
					</ul>
					<h4 class="mt-3 text-lg font-bold">Usage Data</h4>
					<p class="mt-3">Usage Data is collected automatically when using the Service.</p>
					<p class="mt-3">Usage Data may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</p>
					<p class="mt-3">When You access the Service by or through a mobile device, We may collect certain information automatically, including, but not limited to, the type of mobile device You use, Your mobile device unique ID, the IP address of Your mobile device, Your mobile operating system, the type of mobile Internet browser You use, unique device identifiers and other diagnostic data.</p>
					<p class="mt-3">We may also collect information that Your browser sends whenever You visit our Service or when You access the Service by or through a mobile device.</p>
					<h4 class="mt-3 text-lg font-bold">Information from Third-Party Social Media Services</h4>
					<p class="mt-3">The Company allows You to create an account and log in to use the Service through the following Third-party Social Media Services:</p>
					<ul>
						<li class="ms-16 mt-3">Google</li>
						<li class="ms-16 mt-3">Facebook</li>
						<li class="ms-16 mt-3">Instagram</li>
						<li class="ms-16 mt-3">Twitter</li>
						<li class="ms-16 mt-3">LinkedIn</li>
					</ul>
					<p class="mt-3">If You decide to register through or otherwise grant us access to a Third-Party Social Media Service, We may collect Personal data that is already associated with Your Third-Party Social Media Service's account, such as Your name, Your email address, Your activities or Your contact list associated with that account.</p>
					<p class="mt-3">You may also have the option of sharing additional information with the Company through Your Third-Party Social Media Service's account. If You choose to provide such information and Personal Data, during registration or otherwise, You are giving the Company permission to use, share, and store it in a manner consistent with this Privacy Policy.</p>
					<h4 class="mt-3 text-lg font-bold">Information Collected while Using the Application</h4>
					<p class="mt-3">While using Our Application, in order to provide features of Our Application, We may collect, with Your prior permission:</p>
					<ul>
						<li>
							<p class="ms-16 mt-3">Information regarding your location</p>
						</li>
						<li>
							<p class="ms-16 mt-3">Pictures and other information from your Device's camera and photo library</p>
						</li>
					</ul>
					<p class="mt-3">We use this information to provide features of Our Service, to improve and customize Our Service. The information may be uploaded to the Company's servers and/or a Service Provider's server or it may be simply stored on Your device.</p>
					<p class="mt-3">You can enable or disable access to this information at any time, through Your Device settings.</p>
					<h4 class="mt-3 text-lg font-bold">Tracking Technologies and Cookies</h4>
					<p class=">We use Cookies and similar tracking technologies to track the activity on Our Service and store certain information. Tracking technologies used are beacons, tags, and scripts to collect and track information and to improve and analyze Our Service. The technologies We use may include:</p>
					<ul>
						<li class="ms-16 mt-3"><strong>Cookies or Browser Cookies.</strong> A cookie is a small file placed on Your Device. You can instruct Your browser to refuse all Cookies or to indicate when a Cookie is being sent. However, if You do not accept Cookies, You may not be able to use some parts of our Service. Unless you have adjusted Your browser setting so that it will refuse Cookies, our Service may use Cookies.</li>
						<li class="ms-16 mt-3"><strong>Web Beacons.</strong> Certain sections of our Service and our emails may contain small electronic files known as web beacons (also referred to as clear gifs, pixel tags, and single-pixel gifs) that permit the Company, for example, to count users who have visited those pages or opened an email and for other related website statistics (for example, recording the popularity of a certain section and verifying system and server integrity).</li>
					</ul>
					<p class="mt-3">Cookies can be &quot;Persistent&quot; or &quot;Session&quot; Cookies. Persistent Cookies remain on Your personal computer or mobile device when You go offline, while Session Cookies are deleted as soon as You close Your web browser. Learn more about cookies on the <a href="https://www.freeprivacypolicy.com/blog/sample-privacy-policy-template/#Use_Of_Cookies_And_Tracking" target="_blank">Free Privacy Policy website</a> article.</p>
					<p class="mt-3">We use both Session and Persistent Cookies for the purposes set out below:</p>
					<ul>
						<li>
							<p class="ms-16 mt-3"><strong>Necessary / Essential Cookies</strong></p>
							<p class="ms-16 mt-3">Type: Session Cookies</p>
							<p class="ms-16 mt-3">Administered by: Us</p>
							<p class="ms-16 mt-3">Purpose: These Cookies are essential to provide You with services available through the Website and to enable You to use some of its features. They help to authenticate users and prevent fraudulent use of user accounts. Without these Cookies, the services that You have asked for cannot be provided, and We only use these Cookies to provide You with those services.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Cookies Policy / Notice Acceptance Cookies</strong></p>
							<p class="ms-16 mt-3">Type: Persistent Cookies</p>
							<p class="ms-16 mt-3">Administered by: Us</p>
							<p class="ms-16 mt-3">Purpose: These Cookies identify if users have accepted the use of cookies on the Website.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>Functionality Cookies</strong></p>
							<p class="ms-16 mt-3">Type: Persistent Cookies</p>
							<p class="ms-16 mt-3">Administered by: Us</p>
							<p class="ms-16 mt-3">Purpose: These Cookies allow us to remember choices You make when You use the Website, such as remembering your login details or language preference. The purpose of these Cookies is to provide You with a more personal experience and to avoid You having to re-enter your preferences every time You use the Website.</p>
						</li>
					</ul>
					<p class="mt-3">For more information about the cookies we use and your choices regarding cookies, please visit our Cookies Policy or the Cookies section of our Privacy Policy.</p>
					<h3 class="mt-3 text-xl font-bold">Use of Your Personal Data</h3>
					<p class="mt-3">The Company may use Personal Data for the following purposes:</p>
					<ul>
						<li>
							<p class="ms-16 mt-3"><strong>To provide and maintain our Service</strong>, including to monitor the usage of our Service.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>To manage Your Account:</strong> to manage Your registration as a user of the Service. The Personal Data You provide can give You access to different functionalities of the Service that are available to You as a registered user.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>For the performance of a contract:</strong> the development, compliance and undertaking of the purchase contract for the products, items or services You have purchased or of any other contract with Us through the Service.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>To contact You:</strong> To contact You by email, telephone calls, SMS, or other equivalent forms of electronic communication, such as a mobile application's push notifications regarding updates or informative communications related to the functionalities, products or contracted services, including the security updates, when necessary or reasonable for their implementation.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>To provide You</strong> with news, special offers and general information about other goods, services and events which we offer that are similar to those that you have already purchased or enquired about unless You have opted not to receive such information.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>To manage Your requests:</strong> To attend and manage Your requests to Us.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>For business transfers:</strong> We may use Your information to evaluate or conduct a merger, divestiture, restructuring, reorganization, dissolution, or other sale or transfer of some or all of Our assets, whether as a going concern or as part of bankruptcy, liquidation, or similar proceeding, in which Personal Data held by Us about our Service users is among the assets transferred.</p>
						</li>
						<li>
							<p class="ms-16 mt-3"><strong>For other purposes</strong>: We may use Your information for other purposes, such as data analysis, identifying usage trends, determining the effectiveness of our promotional campaigns and to evaluate and improve our Service, products, services, marketing and your experience.</p>
						</li>
					</ul>
					<p class="mt-3">We may share Your personal information in the following situations:</p>
					<ul>
						<li class="ms-16 mt-3"><strong>With Service Providers:</strong> We may share Your personal information with Service Providers to monitor and analyze the use of our Service,  to contact You.</li>
						<li class="ms-16 mt-3"><strong>For business transfers:</strong> We may share or transfer Your personal information in connection with, or during negotiations of, any merger, sale of Company assets, financing, or acquisition of all or a portion of Our business to another company.</li>
						<li class="ms-16 mt-3"><strong>With Affiliates:</strong> We may share Your information with Our affiliates, in which case we will require those affiliates to honor this Privacy Policy. Affiliates include Our parent company and any other subsidiaries, joint venture partners or other companies that We control or that are under common control with Us.</li>
						<li class="ms-16 mt-3"><strong>With business partners:</strong> We may share Your information with Our business partners to offer You certain products, services or promotions.</li>
						<li class="ms-16 mt-3"><strong>With other users:</strong> when You share personal information or otherwise interact in the public areas with other users, such information may be viewed by all users and may be publicly distributed outside. If You interact with other users or register through a Third-Party Social Media Service, Your contacts on the Third-Party Social Media Service may see Your name, profile, pictures and description of Your activity. Similarly, other users will be able to view descriptions of Your activity, communicate with You and view Your profile.</li>
						<li class="ms-16 mt-3"><strong>With Your consent</strong>: We may disclose Your personal information for any other purpose with Your consent.</li>
					</ul>
					<h3 class="mt-3 text-xl font-bold">Retention of Your Personal Data</h3>
					<p class="mt-3">The Company will retain Your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use Your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.</p>
					<p class="mt-3">The Company will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of time, except when this data is used to strengthen the security or to improve the functionality of Our Service, or We are legally obligated to retain this data for longer time periods.</p>
					<h3 class="mt-3 text-xl font-bold">Transfer of Your Personal Data</h3>
					<p class="mt-3">Your information, including Personal Data, is processed at the Company's operating offices and in any other places where the parties involved in the processing are located. It means that this information may be transferred to — and maintained on — computers located outside of Your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from Your jurisdiction.</p>
					<p class="mt-3">Your consent to this Privacy Policy followed by Your submission of such information represents Your agreement to that transfer.</p>
					<p class="mt-3">The Company will take all steps reasonably necessary to ensure that Your data is treated securely and in accordance with this Privacy Policy and no transfer of Your Personal Data will take place to an organization or a country unless there are adequate controls in place including the security of Your data and other personal information.</p>
					<h3 class="mt-3 text-xl font-bold">Delete Your Personal Data</h3>
					<p class="mt-3">You have the right to delete or request that We assist in deleting the Personal Data that We have collected about You.</p>
					<p class="mt-3">Our Service may give You the ability to delete certain information about You from within the Service.</p>
					<p class="mt-3">You may update, amend, or delete Your information at any time by signing in to Your Account, if you have one, and visiting the account settings section that allows you to manage Your personal information. You may also contact Us to request access to, correct, or delete any personal information that You have provided to Us.</p>
					<p class="mt-3">Please note, however, that We may need to retain certain information when we have a legal obligation or lawful basis to do so.</p>
					<h3 class="mt-3 text-xl font-bold">Disclosure of Your Personal Data</h3>
					<h4 class="mt-3 text-lg font-bold">Business Transactions</h4>
					<p class="mt-3">If the Company is involved in a merger, acquisition or asset sale, Your Personal Data may be transferred. We will provide notice before Your Personal Data is transferred and becomes subject to a different Privacy Policy.</p>
					<h4 class="mt-3 text-lg font-bold">Law enforcement</h4>
					<p class="mt-3">Under certain circumstances, the Company may be required to disclose Your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g. a court or a government agency).</p>
					<h4 class="mt-3 text-lg font-bold">Other legal requirements</h4>
					<p class="mt-3">The Company may disclose Your Personal Data in the good faith belief that such action is necessary to:</p>
					<ul>
						<li class="ms-16 mt-3">Comply with a legal obligation</li>
						<li class="ms-16 mt-3">Protect and defend the rights or property of the Company</li>
						<li class="ms-16 mt-3">Prevent or investigate possible wrongdoing in connection with the Service</li>
						<li class="ms-16 mt-3">Protect the personal safety of Users of the Service or the public</li>
						<li class="ms-16 mt-3">Protect against legal liability</li>
					</ul>
					<h3 class="mt-3 text-xl font-bold">Security of Your Personal Data</h3>
					<p class="mt-3">The security of Your Personal Data is important to Us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While We strive to use commercially acceptable means to protect Your Personal Data, We cannot guarantee its absolute security.</p>
					<h2 class="mt-3 text-2xl font-bold">Children's Privacy</h2>
					<p class="mt-3">Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us. If We become aware that We have collected Personal Data from anyone under the age of 13 without verification of parental consent, We take steps to remove that information from Our servers.</p>
					<p class="mt-3">If We need to rely on consent as a legal basis for processing Your information and Your country requires consent from a parent, We may require Your parent's consent before We collect and use that information.</p>
					<h2 class="mt-3 text-2xl font-bold">Links to Other Websites</h2>
					<p class="mt-3">Our Service may contain links to other websites that are not operated by Us. If You click on a third party link, You will be directed to that third party's site. We strongly advise You to review the Privacy Policy of every site You visit.</p>
					<p class="mt-3">We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.</p>
					<h2 class="mt-3 text-2xl font-bold">Changes to this Privacy Policy</h2>
					<p class="mt-3">We may update Our Privacy Policy from time to time. We will notify You of any changes by posting the new Privacy Policy on this page.</p>
					<p class="mt-3">We will let You know via email and/or a prominent notice on Our Service, prior to the change becoming effective and update the &quot;Last updated&quot; date at the top of this Privacy Policy.</p>
					<p class="mt-3">You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>
					<h2 class="mt-3 text-2xl font-bold">Contact Us</h2>
					<p class="mt-3">If you have any questions about this Privacy Policy, You can contact us:</p>
					<ul class="pb-4">
						<li class="ms-16 mt-3">By visiting this page on our website: <a href="https://itstambayan.web.app/help" rel="external nofollow noopener" target="_blank">https://itstambayan.web.app/help</a></li>
					</ul>
				</div>
			</section>`
		)));
	}

	function renderTermsOfServicePage() {
		$('main').html($($.parseHTML(
			`<section class="terms-of-service-layout max-h-screen from-slate-50 dark:bg-gray-900">
				<nav class="navbar top-0 z-50 w-full bg-white dark:bg-gray-900">
					<div class="sm:mx-32 px-3 sm:px-0 py-3 lg:px-5 lg:pl-3">
						<div class="flex items-center justify-between">
							<div class="sm:hidden"></div>
							<div class="flex items-center justify-center sm:justify-start sm:items-start rtl:justify-end">
								<img src="/assets/img/barkada.png" class="w-10 h-10" />
							</div>
							<div class="flex items-center">
								<div class="flex items-center ms-3">
									<div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</nav>

				<div class="animate__animated animate__fadeIn px-4 pb-4 sm:px-32 dark:text-white p-4 pt-4 px-0 sm:pb-0">
					<h2 class="text-2xl font-bold"><strong>Terms and Conditions</strong></h2>

					<p class="mt-3">Welcome to Tambayan!</p>

					<p class="mt-3">These terms and conditions outline the rules and regulations for the use of Tambayan, Inc.'s Website, located at https://itstambayan.web.app.</p>

					<p class="mt-3">By accessing this website we assume you accept these terms and conditions. Do not continue to use Tambayan if you do not agree to take all of the terms and conditions stated on this page.</p>

					<p class="mt-3">The following terminology applies to these Terms and Conditions, Privacy Statement and Disclaimer Notice and all Agreements: "Client", "You" and "Your" refers to you, the person log on this website and compliant to the Company's terms and conditions. "The Company", "Ourselves", "We", "Our" and "Us", refers to our Company. "Party", "Parties", or "Us", refers to both the Client and ourselves. All terms refer to the offer, acceptance and consideration of payment necessary to undertake the process of our assistance to the Client in the most appropriate manner for the express purpose of meeting the Client's needs in respect of provision of the Company's stated services, in accordance with and subject to, prevailing law of ph. Any use of the above terminology or other words in the singular, plural, capitalization and/or he/she or they, are taken as interchangeable and therefore as referring to same.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Cookies</strong></h3>

					<p class="mt-3">We employ the use of cookies. By accessing Tambayan, you agreed to use cookies in agreement with the Tambayan, Inc.'s Privacy Policy. </p>

					<p class="mt-3">Most interactive websites use cookies to let us retrieve the user's details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>License</strong></h3>

					<p class="mt-3">Unless otherwise stated, Tambayan, Inc. and/or its licensors own the intellectual property rights for all material on Tambayan. All intellectual property rights are reserved. You may access this from Tambayan for your own personal use subjected to restrictions set in these terms and conditions.</p>

					<p class="mt-3">You must not:</p>
					<ul>
						<li class="ms-16 mt-3">Republish material from Tambayan</li>
						<li class="ms-16 mt-3">Sell, rent or sub-license material from Tambayan</li>
						<li class="ms-16 mt-3">Reproduce, duplicate or copy material from Tambayan</li>
						<li class="ms-16 mt-3">Redistribute content from Tambayan</li>
					</ul>

					<p class="mt-3">Parts of this website offer an opportunity for users to post and exchange opinions and information in certain areas of the website. Tambayan, Inc. does not filter, edit, publish or review Comments prior to their presence on the website. Comments do not reflect the views and opinions of Tambayan, Inc.,its agents and/or affiliates. Comments reflect the views and opinions of the person who post their views and opinions. To the extent permitted by applicable laws, Tambayan, Inc. shall not be liable for the Comments or for any liability, damages or expenses caused and/or suffered as a result of any use of and/or posting of and/or appearance of the Comments on this website.</p>

					<p class="mt-3">Tambayan, Inc. reserves the right to monitor all Comments and to remove any Comments which can be considered inappropriate, offensive or causes breach of these Terms and Conditions.</p>

					<p class="mt-3">You warrant and represent that:</p>

					<ul>
						<li class="ms-16 mt-3">You are entitled to post the Comments on our website and have all necessary licenses and consents to do so;</li>
						<li class="ms-16 mt-3">The Comments do not invade any intellectual property right, including without limitation copyright, patent or trademark of any third party;</li>
						<li class="ms-16 mt-3">The Comments do not contain any defamatory, libelous, offensive, indecent or otherwise unlawful material which is an invasion of privacy</li>
						<li class="ms-16 mt-3">The Comments will not be used to solicit or promote business or custom or present commercial activities or unlawful activity.</li>
					</ul>

					<p class="mt-3">You hereby grant Tambayan, Inc. a non-exclusive license to use, reproduce, edit and authorize others to use, reproduce and edit any of your Comments in any and all forms, formats or media.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Hyperlinking to our Content</strong></h3>

					<p class="mt-3">The following organizations may link to our Website without prior written approval:</p>

					<ul>
						<li class="ms-16 mt-3">Government agencies;</li>
						<li class="ms-16 mt-3">Search engines;</li>
						<li class="ms-16 mt-3">News organizations;</li>
						<li class="ms-16 mt-3">Online directory distributors may link to our Website in the same manner as they hyperlink to the Websites of other listed businesses; and</li>
						<li class="ms-16 mt-3">System wide Accredited Businesses except soliciting non-profit organizations, charity shopping malls, and charity fundraising groups which may not hyperlink to our Web site.</li>
					</ul>

					<p class="mt-3">These organizations may link to our home page, to publications or to other Website information so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products and/or services; and (c) fits within the context of the linking party's site.</p>

					<p class="mt-3">We may consider and approve other link requests from the following types of organizations:</p>

					<ul>
						<li class="ms-16 mt-3">commonly-known consumer and/or business information sources;</li>
						<li class="ms-16 mt-3">dot.com community sites;</li>
						<li class="ms-16 mt-3">associations or other groups representing charities;</li>
						<li class="ms-16 mt-3">online directory distributors;</li>
						<li class="ms-16 mt-3">internet portals;</li>
						<li class="ms-16 mt-3">accounting, law and consulting firms; and</li>
						<li class="ms-16 mt-3">educational institutions and trade associations.</li>
					</ul>

					<p class="mt-3">We will approve link requests from these organizations if we decide that: (a) the link would not make us look unfavorably to ourselves or to our accredited businesses; (b) the organization does not have any negative records with us; (c) the benefit to us from the visibility of the hyperlink compensates the absence of Tambayan, Inc.; and (d) the link is in the context of general resource information.</p>

					<p class="mt-3">These organizations may link to our home page so long as the link: (a) is not in any way deceptive; (b) does not falsely imply sponsorship, endorsement or approval of the linking party and its products or services; and (c) fits within the context of the linking party's site.</p>

					<p class="mt-3">If you are one of the organizations listed in paragraph 2 above and are interested in linking to our website, you must inform us by sending an e-mail to Tambayan, Inc.. Please include your name, your organization name, contact information as well as the URL of your site, a list of any URLs from which you intend to link to our Website, and a list of the URLs on our site to which you would like to link. Wait 2-3 weeks for a response.</p>

					<p class="mt-3">Approved organizations may hyperlink to our Website as follows:</p>

					<ul>
						<li class="ms-16 mt-3">By use of our corporate name; or</li>
						<li class="ms-16 mt-3">By use of the uniform resource locator being linked to; or</li>
						<li class="ms-16 mt-3">By use of any other description of our Website being linked to that makes sense within the context and format of content on the linking party's site.</li>
					</ul>

					<p class="mt-3">No use of Tambayan, Inc.'s logo or other artwork will be allowed for linking absent a trademark license agreement.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>iFrames</strong></h3>

					<p class="mt-3">Without prior approval and written permission, you may not create frames around our Webpages that alter in any way the visual presentation or appearance of our Website.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Content Liability</strong></h3>

					<p class="mt-3">We shall not be hold responsible for any content that appears on your Website. You agree to protect and defend us against all claims that is rising on your Website. No link(s) should appear on any Website that may be interpreted as libelous, obscene or criminal, or which infringes, otherwise violates, or advocates the infringement or other violation of, any third party rights.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Reservation of Rights</strong></h3>

					<p class="mt-3">We reserve the right to request that you remove all links or any particular link to our Website. You approve to immediately remove all links to our Website upon request. We also reserve the right to amen these terms and conditions and it's linking policy at any time. By continuously linking to our Website, you agree to be bound to and follow these linking terms and conditions.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Removal of links from our website</strong></h3>

					<p class="mt-3">If you find any link on our Website that is offensive for any reason, you are free to contact and inform us any moment. We will consider requests to remove links but we are not obligated to or so or to respond to you directly.</p>

					<p class="mt-3">We do not ensure that the information on this website is correct, we do not warrant its completeness or accuracy; nor do we promise to ensure that the website remains available or that the material on the website is kept up to date.</p>

					<h3 class="mt-3 text-xl font-bold"><strong>Disclaimer</strong></h3>

					<p class="mt-3">To the maximum extent permitted by applicable law, we exclude all representations, warranties and conditions relating to our website and the use of this website. Nothing in this disclaimer will:</p>

					<ul>
						<li class="ms-16 mt-3">limit or exclude our or your liability for death or personal injury;</li>
						<li class="ms-16 mt-3">limit or exclude our or your liability for fraud or fraudulent misrepresentation;</li>
						<li class="ms-16 mt-3">limit any of our or your liabilities in any way that is not permitted under applicable law; or</li>
						<li class="ms-16 mt-3">exclude any of our or your liabilities that may not be excluded under applicable law.</li>
					</ul>

					<p class="mt-3">The limitations and prohibitions of liability set in this Section and elsewhere in this disclaimer: (a) are subject to the preceding paragraph; and (b) govern all liabilities arising under the disclaimer, including liabilities arising in contract, in tort and for breach of statutory duty.</p>

					<p class="mt-3">As long as the website and the information and services on the website are provided free of charge, we will not be liable for any loss or damage of any nature.</p>
				</div>
			</section>`
		)));
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

						<div class="hidden">
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
			get(query(ref(database, 'beta'), orderByChild('email'), equalTo(email)))
				.then((snapshot) => {
					if (snapshot.exists()) {
						const data = snapshot.val();
						snapshot.forEach((item) => {
							const beta = data[item.key];
							if (beta.access === true) {
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
							} else {
								$('.btn-create-account').html(`Create account`).removeAttr('disabled');
								new TDialog('Only with invite link can signup at this time.').show();
							}
						});
					} else {
						$('.btn-create-account').html(`Create account`).removeAttr('disabled');
						new TDialog('Only with invite link can signup at this time.').show();
					}
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
			`<section class="create-post-layout animate__animated fixed hidden bg-white dark:bg-gray-900 z-50 top-0 start-0 end-0 w-full h-full max-h-screen sm:bg-white sm:h-96 sm:w-96 sm:rounded-xl sm:border sm:mx-auto sm:mt-32 dark:border-gray-800">
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

						if (path() === '/p/' + getLastPathSegment()) {
							renderPostCommentPage();
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

						if (path() === '/u/' + getLastPathSegment()) {
							renderProfilePage();
						}

						if (path() === '/beta/signup') {
							redirect('/');
						}

						if (path() === '/privacy-policy') {
							renderPrivacyPolicyPage();
						}

						if (path() === '/terms-of-service') {
							renderTermsOfServicePage();
						}
					}
				} else {

					if (path() === '/') {
						renderWelcomePage();
					}

					if (path() === '/p/' + getLastPathSegment()) {
						renderPostCommentPage();
					}

					if (path() === '/beta/signup') {
						renderBetaPage();
					}

					if (path() === '/privacy-policy') {
						renderPrivacyPolicyPage();
					}

					if (path() === '/terms-of-service') {
						renderTermsOfServicePage();
					}

					if (path() === '/u/' + getLastPathSegment()) {
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
													<button type="button" class="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden focus:outline-none dark:text-gray-400">
													</button>
													<div class="flex items-center justify-start rtl:justify-end">
														<a href="/" class="flex md:me-24">
                              <img src="/assets/img/barkada.png" class="w-10 h-10"/>
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