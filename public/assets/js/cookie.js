import 'https://unpkg.com/@porscheofficial/cookie-consent-banner@4.0.2/dist/cookie-consent-banner/cookie-consent-banner.esm.js';

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
	window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-ZJGDFMPRMQ');
}

window.addEventListener(
	"cookie_consent_preferences_restored",
	loadTagManager
);
window.addEventListener("cookie_consent_preferences_updated", loadTagManager);