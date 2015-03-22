var bgWindow = null;

$(document).ready(function(){
    if(bgWindow == null){
        bgWindow = chrome.extension.getBackgroundPage();
    }
		setInterval(function(){$('#info_p').html(bgWindow.document.getElementById('info').innerHTML)},1000);
	
		$('#btn').click(function(){
	doLogin();
});

$('#xx')[0].onkeypress=keypress; 

function keypress(e) 
{ 
var currKey=0,e=e||event; 
if(e.keyCode==13)
doLogin();
} 



});

