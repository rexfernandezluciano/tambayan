import 'https://code.jquery.com/jquery-3.7.1.min.js';

var isShowing = false;

class TDialog {

	constructor(message) {
		this.body(message);
		return;
	}

	parseDialog(message) {
		return $($.parseHTML(
			`<div id="dialog" class="w-full h-full">
			   <div id="dialog-overlay" class="fixed top-0 start-0 w-full h-full"></div>
			     <div id="dialog-body" class="bg-white text-gray-600 rounded-xl dark:bg-gray-900 dark:text-white border border-gray-300 dark:border-gray-800 text-center relative px-8 py-2 top-0 start-0 end-0 bottom-0 mx-auto h-32 mt-32 block w-72 animate__animated">
				     <p id="dialog-message" class="pt-8 pb-3">${message}</p>
				     <div class="flex items-center justify-center">
				      <button id="dialog-close" class="rounded-xl py-1.5 px-2 mb-1.5 hover:bg-blue-300 bottom-0 text-blue-600 font-semibold">Okay</button>
				     </div>
			   </div>
		   </div>`
		));
	}

	body(message) {
		$('body').append(this.parseDialog(message));
		$('#dialog-close').click(() => {
			$('#dialog').hide();
			$('#dialog').remove();
			isShowing = false;
		});
	}

	show() {
		$('#dialog-overlay').click(() => {
			$('#dialog').remove();
			isShowing = false;
		});
		if (isShowing) {
			$('#dialog').hide();
			$('#dialog').remove();
			isShowing = false;
		} else {
			$('#dialog-body').addClass('animate__bounceIn');
			$('#dialog').show();
			isShowing = true;
		}
	}
}

export default TDialog;