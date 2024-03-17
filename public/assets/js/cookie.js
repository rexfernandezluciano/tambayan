import 'https://unpkg.com/@porscheofficial/cookie-consent-banner@4.0.2/dist/cookie-consent-banner/cookie-consent-banner.esm.js';
import 'https://code.jquery.com/jquery-3.7.1.min.js';

(($) => {
	$(document).ready(() => {
		$('body').append($($.parseHTML(
			`<cookie-consent-banner
		    btn-label-accept-and-continue="Agree and continue" btn-label-only-essential-and-continue="Continue with technically required cookies only"
				btn-label-persist-selection-and-continue="Save selection and continue"
				btn-label-select-all-and-continue="Select all and continue"
				content-settings-description="You can decide which cookies are used by selecting the respective options below. Please note that your selection may impair in the functionality of the service.">
				We use cookies and similar technologies to provide certain features, enhance
				the user experience and deliver content that is relevant to your interests.
				Depending on their purpose, analysis and marketing cookies may be used in
				addition to technically necessary cookies. By clicking on "Agree and
				continue", you declare your consent to the use of the aforementioned cookies.
				<a class="text-blue-600 font-bold hover:text-blue-500" href="javascript:document.dispatchEvent(new Event('cookie_consent_details_show'))">
					Here
				</a>
				you can make detailed settings or revoke your consent (in part if necessary)
				with effect for the future. For further information, please refer to our
				<a href="/privacy-policy">Privacy Policy</a>
				.
			</cookie-consent-banner>`
		)));

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
				label: "Analytics",
			},
			{
				description:
					"Enable us to offer and evaluate relevant content and interest-based advertising.",
				key: "marketing",
				label: "Marketing",
			},
			{
				description:
					"Show personalize ads based on user activities and interests.",
				key: "ad_personalization",
				label: "Personalize Ad",
			}
		];

		window.dataLayer = window.dataLayer || [];

		function gtag() {
			dataLayer.push(arguments);
		}

		gtag('js', new Date());
		gtag('config', 'G-ZJGDFMPRMQ');
		gtag('consent', 'default', {
			'ad_storage': 'denied',
			'ad_user_data': 'denied',
			'ad_personalization': 'denied',
			'analytics_storage': 'denied'
		});

		function loadAnalyticsConsent() {
			gtag('consent', 'update', {
				'ad_storage': 'granted',
				'analytics_storage': 'granted'
			});
		}

		function loadAdPersonalizationConsent() {
			gtag('consent', 'update', {
				'ad_user_data': 'granted',
				'ad_personalization': 'granted'
			});
		}

		function loadAnalyticsScript() {
			const scriptElementExists = document.querySelector("[data-scriptid='ga']");
			if (scriptElementExists || window?.ga) return;

			const firstScriptElement = document.getElementsByTagName("script")[0];

			const scriptElement = document.createElement("script");
			scriptElement.type = "text/javascript";
			scriptElement.setAttribute("async", "true");
			scriptElement.setAttribute(
				"src",
				"https://www.googletagmanager.com/gtag/js?id=G-ZJGDFMPRMQ"
			);
			scriptElement.setAttribute("data-scriptid", "ga");

			firstScriptElement.parentNode.insertBefore(
				scriptElement,
				firstScriptElement
			);
		}

		function loadDefaultConsent() {
			gtag('consent', 'default', {
				'ad_storage': 'denied',
				'ad_user_data': 'denied',
				'ad_personalization': 'denied',
				'analytics_storage': 'denied'
			});
		}

		function loadScripts(event) {
			loadDefaultConsent();
			const acceptedCategories = event?.detail?.acceptedCategories;
			if (acceptedCategories.includes("analytics")) {
				loadAnalyticsScript();
				loadAnalyticsConsent();
			}

			if (acceptedCategories.includes("marketing")) {
				//
			}

			if (acceptedCategories.includes("technically_required")) {
				//
			}

			if (acceptedCategories.includes("ad_personalization")) {
				loadAdPersonalizationConsent();
			}
		}

		window.addEventListener(
			"cookie_consent_preferences_restored",
			loadScripts
		);
		window.addEventListener("cookie_consent_preferences_updated", loadScripts);
	});
})(jQuery);