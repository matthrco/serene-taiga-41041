/*
  Copy text from any appropriate field to the clipboard
  By Craig Buckler, @craigbuckler
  use it, abuse it, do whatever you like with it!
*/
document.addEventListener('click', function copy(e) {
	// find target element
    var t = e.target, c = t.dataset.copytarget, inp = (c ? document.querySelector(c) : null);
    // is element selectable?
    if (inp && inp.select) {
		// select text
		inp.select();
		try {
			// copy text
			document.execCommand('copy');
			inp.blur();
		}
		catch (err) {
        alert('please press Ctrl/Cmd+C to copy');
		}
    }
});