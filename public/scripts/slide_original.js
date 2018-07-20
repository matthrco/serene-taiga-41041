/**
 *
 * Puzzle box game jQuery plugin
 * Based on a tutorial by Dhiraj Kumar
 * http://www.css-jquery-design.com
 */

var zi = 1; 
var EmptySquare = 16;
var n=0;
var moves = '';
$.fn.extend({
puzzle_dg:
	function(e, sequence){
		var object = t;
		for (var property in object) {
			if (object.hasOwnProperty(property)) {
				console.log(property);
			}
		}
		var t="#"+$(this).attr("id");
		var gameborder=e*4+"px";
		//$(t).html('<div id="board"></div>');
		for(var i=0;i<16;i++){
			$("#board").append("<div style='left: "+i%4*e+"px; top: "+Math.floor(i/4)*e+"px; width: "+e+"px; height: "+e+"px; background-position: "+ -(i%4)*e+"px "+ -Math.floor(i/4)*e+"px ' ></div>")}$("#board").children("div:nth-child("+EmptySquare+")").css({backgroundImage:"",background:"#ffffff"});
			$("#board").children("div").click(function(){Move(this,e)});
			Moveblank(sequence);
	}
})
function Move(e,t){
	var n='';
	var r=$("#board").children("div:nth-child("+EmptySquare+")").css("left");
	var i=$("#board").children("div:nth-child("+EmptySquare+")").css("top");
	var s=$(e).css("left");
	var o=$(e).css("top");
	if(r==s&&o==parseInt(i)-t+"px")n='u';
	if(r==s&&o==parseInt(i)+t+"px")n='d';
	if(parseInt(r)-t+"px"==s&&o==i)n='l';
	if(parseInt(r)+t+"px"==s&&o==i)n='r';
	if(n!== ''){
	$(e).css("z-index",zi++);
	$(e).animate({left:r,top:i},200,function(){
	$("#board").children("div:nth-child("+EmptySquare+")").css("left",s);
	$("#board").children("div:nth-child("+EmptySquare+")").css("top",o);
	moves = moves + n;
	var sol = "";
	for(var i=1;i<17;i++){
		sol = sol + $("#board").children("div:nth-child("+i+")").css("left") + $("#board").children("div:nth-child("+i+")").css("top");
	}
	if(sol === "0px0px140px0px280px0px420px0px0px140px140px140px280px140px420px140px0px280px140px280px280px280px420px280px0px420px140px420px280px420px420px420px"){
		complete(moves);
	}
	sendMove(n);
	;})}	
}

function Moveblank(sequence){
	var t = 140;
	var s;
	var o;
	var r=$("#board").children("div:nth-child("+EmptySquare+")").css("left");
	var i=$("#board").children("div:nth-child("+EmptySquare+")").css("top");
	if(sequence[0]==="u"){
		s=r;
		o=parseInt(i)-t+"px";
	}
	if(sequence[0]==="d"){
		s=r;
		o=parseInt(i)+t+"px";
	}
	if(sequence[0]==="r"){
		s=parseInt(r)+t+"px"; 
		o=i;
	}
	if(sequence[0]==="l"){
		s=parseInt(r)-t+"px"; 
		o=i;
	}
	if(sequence[0]==="o"){
		s=r; 
		o=i;
	}
	var e;
	for(var j=1;j<17;j++){
		if($("#board").children("div:nth-child("+j+")").css("left") + $("#board").children("div:nth-child("+j+")").css("top") === s+o){
			e = $("#board").children("div:nth-child("+j+")");
		}
	}
	$(e).css("z-index",zi++);
	$(e).animate({left:r,top:i},200,function(){
	$("#board").children("div:nth-child("+EmptySquare+")").css("left",s);
	$("#board").children("div:nth-child("+EmptySquare+")").css("top",o);
	moves = moves + sequence[0];
	Moveblank(sequence.substring(1));
	;})
}

function sendMove(move){
	$.ajax({
		type: 'POST',
		url: 'https://serene-taiga-41041.herokuapp.com/move',
		data: 'uniqueid='+getCookie("uniqueID")+'&sec='+getCookie("sec")+'&move='+move,
	});
}


function getCookie(cname) {
		var name = cname + "=";
		var ca = document.cookie.split(';');
		for(var i=0; i<ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') {
				c = c.substring(1);
			}
			if (c.indexOf(name) == 0) {
				return c.substring(name.length, c.length);
			}
		}
		return "";
	}
	
	function setCookie(cname, cvalue) {
		document.cookie = cname + "=" + cvalue + ";path=/";
	}
	
	function complete(moves){
		$.ajax({
			type: 'POST',
			url: 'https://serene-taiga-41041.herokuapp.com/completed',
			data: 'uniqueid='+getCookie("uniqueID")+'&sec='+getCookie("sec")+'&responses='+moves,
		});
		location.reload();
	}