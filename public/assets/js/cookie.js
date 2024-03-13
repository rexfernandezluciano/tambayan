import 'https://unpkg.com/@porscheofficial/cookie-consent-banner@1.0.0/dist/cookie-consent-banner/cookie-consent-banner.esm.js';
/* Update available Cookie Categories */
const cookieConsentBannerElement = document.querySelector(
	"cookie-consent-banner"
);
cookieConsentBannerElement.availableCategories = [
	{
		description:
			"Enable you to navigate and use the basic functions and to store preferences.",
		key: "technically_required",
		label: "Technically necessary cookies",
		isMandatory: true,
	},
	{
		description:
			"Enable us to determine how visitors interact with our service in order to improve the user experience.",
		key: "analytics",
		label: "Analysis cookies",
	},
	{
		description:
			"Enable us to offer and evaluate relevant content and interest-based advertising.",
		key: "marketing",
		label: "Marketing cookies",
	},
];

function loadTagManager() {
	if (typeof google_tag_manager !== "undefined") return; // load only once
	const gTags = function (w, d, s, l, i) {
		w[l] = w[l] || [];
		w[l].push({
			"gtm.start": new Date().getTime(),
			event: "gtm.js",
		});
		let f = d.getElementsByTagName(s)[0],
			j = d.createElement(s),
			dl = l != "dataLayer" ? "&l=" + l : "";
		j.async = true;
		j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
		f.parentNode.insertBefore(j, f);
	};

	gTags(window, document, "script", "dataLayer", "GTM-XXX");
}
window.addEventListener(
	"cookie_consent_preferences_restored",
	loadTagManager
);
window.addEventListener("cookie_consent_preferences_updated", loadTagManager);