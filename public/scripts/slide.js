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
var grid = '';
var positions = {	"0px0px": 0, "140px0px": 1, "280px0px": 2, "420px0px": 3, 
					"0px140px": 4, "140px140px": 5, "280px140px": 6, "420px140px": 7,
					"0px280px": 8, "140px280px": 9,	"280px280px": 10, "420px280px": 11,
					"0px420px": 12, "140px420px": 13, "280px420px": 14, "420px420px":15}; 

$.fn.extend({
puzzle_dg:
	function(layout){
		tileLength = Math.max($(".jumbotron").width()/11, 70);
		$("#game_area").css({"height": 4*tileLength, "width": 4*tileLength});
		var arz = JSON.parse(layout);
		grid = layout;
		for(var i=0;i<16;i++){
			//add tiles
			$("#board").append("<div style='left: "+arz[i]%4*tileLength+"px; top: "+Math.floor(arz[i]/4)*tileLength+"px; width: "+tileLength+"px; height: "+tileLength+"px; background-position: "+ -(i%4*tileLength)+"px "+ -Math.floor(i/4)*tileLength+"px; background-size: "+ 4*tileLength +"px "+ 4*tileLength +"px ' ></div>")
		}
		//make blank tile blank
		$("#board").children("div:nth-child("+EmptySquare+")").css({backgroundImage:"",background:"#ffffff"});
		//add click listeners
		$("#board").children("div").click(function(){Move(this,tileLength)});
	}
})

function Move(clickedTile,tileLength){
	var n='';
	var emptySquareLeftOffset=$("#board").children("div:nth-child("+EmptySquare+")").css("left");
	var emptySquareTopOffset=$("#board").children("div:nth-child("+EmptySquare+")").css("top");
	var clickedSquareLeftOffset=$(clickedTile).css("left");
	var clickedSquareTopOffset=$(clickedTile).css("top");
	if(emptySquareLeftOffset==clickedSquareLeftOffset&&clickedSquareTopOffset==parseInt(emptySquareTopOffset)-tileLength+"px")n='u';
	if(emptySquareLeftOffset==clickedSquareLeftOffset&&clickedSquareTopOffset==parseInt(emptySquareTopOffset)+tileLength+"px")n='d';
	if(parseInt(emptySquareLeftOffset)-tileLength+"px"==clickedSquareLeftOffset&&clickedSquareTopOffset==emptySquareTopOffset)n='l';
	if(parseInt(emptySquareLeftOffset)+tileLength+"px"==clickedSquareLeftOffset&&clickedSquareTopOffset==emptySquareTopOffset)n='r';
	if(n!== ''){
		$(clickedTile).css("z-index",zi++);
		$(clickedTile).animate({left:emptySquareLeftOffset,top:emptySquareTopOffset},200,function(){
			$("#board").children("div:nth-child("+EmptySquare+")").css("left",clickedSquareLeftOffset);
			$("#board").children("div:nth-child("+EmptySquare+")").css("top",clickedSquareTopOffset);
			layout = [];
			for(var i=1;i<17;i++){
				layout.push(positions[$("#board").children("div:nth-child("+i+")").css("left") + $("#board").children("div:nth-child("+i+")").css("top")]);
			}
			sendMove(n, layout);
			if(layout.toString() === [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].toString()){
				complete();
			}
		})
	}	
}

function sendMove(move, layout){
	$.ajax({
		type: 'POST',
		url: './move',
		data: 'move='+move+'&layout=['+layout.toString()+']',
	});
}

function complete(){
	$.ajax({
		type: 'POST',
		url: './complete'
	}).done(function() {
		window.location.reload();
	});
}