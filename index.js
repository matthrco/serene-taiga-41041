var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var pg = require('pg');
var bodyParser = require('body-parser');
var requests = require('request');

app.use(cookieParser());
app.use(bodyParser.json()); //for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing application/x-www-form-urlencoded
app.use(express.static(__dirname + '/public'));

app.enable('trust proxy');

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('port', (process.env.PORT || 5000));

var adcode = 'ad12345678';
var ipLimit = 30;
var taskTime = "'24 hours'";
var numberOfTreatments = 3;
var treatmentLimitFromAds = 100;
var treatmentLimitFromReferrals = 100;
var referralLimit = 10;
var treeLimit = 20;
var treeLimitOn = true;
var timeToRefer = "'7 days'";
//slot is reserved for this long if person referred never accepts the task
var reservedSlotTime = "'20 minutes'";
var captchakey = '6LdJtxUUAAAAAJJbaCPFYIs7t7cHKS4oOi6d-W1O';
var startingPoints = [	'[11,10,0,7,4,1,2,12,5,3,14,9,8,13,6,15]', 
						'[3,6,11,1,0,12,9,13,2,10,4,15,8,7,14,5]',
						'[5,15,6,12,11,1,3,14,0,8,2,7,4,13,9,10]', 
						'[5,3,0,1,7,15,11,14,13,2,6,12,8,4,9,10]'];

app.get("/", function(request, response) {
	if(request.cookies.uniqueID !== undefined){
		response.redirect("/"+request.cookies.uniqueID);
	}else{
		response.render('pages/text', {text: "Invalid Page"});
	}
});

app.get(/^\/[a-zA-Z0-9]{10}$/, function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		if(request.path.substring(1) === adcode){
			//check if cookie has already been set
			if(request.cookies.uniqueID !== undefined){
				response.redirect("/"+request.cookies.uniqueID);
			}else{
				//count the number of people referred by ads on each treatment
				client.query('SELECT count(*) FROM treatment WHERE uniqueid IN (SELECT uniqueid FROM person WHERE uniqueid=root)', function(err, result) {
					done();
					if (err){
						console.error(err); response.send("Error " + err);
					}else{
						//check if treatment limit hasn't been reached
						if(result.rows[0].count <= (treatmentLimitFromAds * numberOfTreatments)){
							//create new user
							client.query("INSERT INTO person (uniqueid, securecode, registrationtime, referrerid) VALUES (createuniqueid(), md5(random()::text), now(), $1) RETURNING uniqueid, securecode", [request.path.substring(1)], function(err, result) {
								done();
								if (err){
									console.error(err); response.send("Error " + err);
								}else{
									//set this person's root as their own id
									client.query("UPDATE person SET root = $1 WHERE uniqueid = $1", [result.rows[0].uniqueid]);
									done();
									client.query("INSERT INTO activity (uniqueid, time) VALUES ($1, now())", [result.rows[0].uniqueid]])
									done();
									//set cookie to new user
									response.cookie('uniqueID', result.rows[0].uniqueid);
									response.cookie('sec', result.rows[0].securecode);
									response.redirect("/"+result.rows[0].uniqueid);
								}
							});
						}else{
							//no longer accepting people who have followed an ad link
							response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
						}
					}
				});
			}
		}else{
			//return information relevant to the user id from the address bar
			client.query('SELECT *, now()-starttime>interval '+taskTime+' AS timeup FROM person LEFT JOIN task ON person.uniqueid=task.uniqueid LEFT JOIN treatment ON person.uniqueid=treatment.uniqueid WHERE person.uniqueid=$1', [request.path.substring(1)], function(err, result) {
				done();
				if (err){
					console.error(err); response.send("Error " + err);
				}else{
					//check the id exists in the system
					if(result.rows[0] !== undefined){
						//check if cookie has already been set for user
						if(request.cookies.uniqueID !== undefined){
							//if user has accepted to start the task
							if(result.rows[0].starttime !== null){
								//if on user's correct page
								if(request.cookies.uniqueID === request.path.substring(1)){
									//security check if the user has the correct secure code (acts as a password)
									if(result.rows[0].securecode === request.cookies.sec){
										//retrieve current budget and check it is not exceeded
										client.query('SELECT *, treatment'+result.rows[0].treatment+' AS treatment FROM currentbudget', function(err, budgetresult) {
											done();
											if (err){
												console.error(err); response.send("Error " + err);
											}else{
												//determine if the user has completed the task
												if(result.rows[0].endtime !== null){
													client.query('SELECT * FROM treatment JOIN voucher ON treatment.uniqueid=voucher.uniqueid LEFT JOIN split ON treatment.uniqueid=split.uniqueid LEFT JOIN extravoucher ON treatment.uniqueid=extravoucher.uniqueid LEFT JOIN email ON treatment.uniqueid=email.uniqueid WHERE treatment.uniqueid=$1 ORDER BY email.time DESC', [request.cookies.uniqueID], function(err, result) {
														done();
														if (err){
															console.error(err); response.send("Error " + err);
														}else{
															client.query('SELECT count(*) FROM person JOIN task ON person.uniqueid=task.uniqueid WHERE referrerid=$1 AND endtime IS NOT NULL', [request.cookies.uniqueID], function(err, result2) {
																done();
																if (err){
																	console.error(err); response.send("Error " + err);
																}else{
																	//show users personal dashboard													
																	if(result.rows[0].email !== null && result.rows[0].seen === false){
																		response.render('pages/dashboard', {vouchercode: result.rows[0].vouchercode, treatment:result.rows[0].treatment, split:result.rows[0].split, referred:result2.rows[0].count, budget: Math.min(budgetresult.rows[0].treatment, budgetresult.rows[0].total, budgetresult.rows[0].task), extravoucher:result.rows[0].extravoucher, email:result.rows[0].email});
																	}else{
																		response.render('pages/dashboard', {vouchercode: result.rows[0].vouchercode, treatment:result.rows[0].treatment, split:result.rows[0].split, referred:result2.rows[0].count, budget: Math.min(budgetresult.rows[0].treatment, budgetresult.rows[0].total, budgetresult.rows[0].task), extravoucher:result.rows[0].extravoucher, email:""});	
																	}
																}
															});
														}
													});
												}else{
													//check that time hasn't run out
													if(result.rows[0].timeup){
														//time up page
														response.render('pages/text', {text: "Sorry, your time limit has run out and you are no longer able to take part."});
													}else{
														if(budgetresult.rows[0].treatment > 0 && budgetresult.rows[0].total > 0 && budgetresult.rows[0].task > 0){
															//show task screen
															response.render('pages/taskscreen', {layout: result.rows[0].layout});
														}else{
															//when budget exceeded
															response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
														}
													}
												}
											}
										});
									}else{
										//malicious user spoofing cookies
										response.render('pages/text', {text: "Invalid Page"});
									}
								}else{
									//TODO detect when someone tries to take another offer after accepting
									//redirect to the correct page
									response.redirect("/"+request.cookies.uniqueID);
								}
							}else{
								//if user has followed a referral link and not yet accepted the task, check that the link is not their own
								if(request.cookies.uniqueID !== request.path.substring(1)){
									checkLimits(result, request, response, client, done, function(){
										//create new user with new referrer and a link to ID of previous cookie
										client.query("INSERT INTO person (uniqueid, securecode, registrationtime, referrerid, previousid) VALUES (createuniqueid(), md5(random()::text), now(), $1, $2) RETURNING uniqueid, securecode", [request.path.substring(1), request.cookies.uniqueID], function(err, result) {
											done();
											if (err){
												console.error(err); response.send("Error " + err);
											}else{
												client.query("UPDATE person SET root = (SELECT root FROM person WHERE uniqueid = $1) WHERE uniqueid = $2", [request.path.substring(1), result.rows[0].uniqueid]);
												done();
												client.query("INSERT INTO activity (uniqueid, time) VALUES ($1, now())", [result.rows[0].uniqueid]])
												done();
												//set cookie to new user
												response.cookie('uniqueID', result.rows[0].uniqueid);
												response.cookie('sec', result.rows[0].securecode);
												response.redirect("/"+result.rows[0].uniqueid);
											}
										});
									});
								}else{
									//check if budget not exceeded
									client.query('SELECT * FROM currentbudget', function(err, budgetresult) {
										done();
										if (err){
											console.error(err); response.send("Error " + err);
										}else{
											if(budgetresult.rows[0].total > 0 && budgetresult.rows[0].task > 0){
												if(result.rows[0].referrerid === adcode){
													if(request.cookies.ins !== undefined){
														//update the last active time for the user to update their activity window
														client.query("UPDATE activity SET time = now() WHERE uniqueid = $1", [request.cookies.uniqueID])
														done();
														//second page of instructions
														response.render('pages/taskstart', {captchatext: ""});	
													}else{
														//first page those from ads see
														response.render('pages/index', {treatment: undefined, split: undefined});										
													}
												}else{
													client.query('SELECT treatment, split FROM treatment LEFT JOIN split on treatment.uniqueid=split.uniqueid WHERE treatment.uniqueid=$1', [result.rows[0].referrerid], function(err, result) {
														done();
														if (err){
															console.error(err); response.send("Error " + err);
														}else{
															if(result.rows[0].split !== null){
																if(request.cookies.ins !== undefined){
																	//update the last active time for the user to update their activity window
																	client.query("UPDATE activity SET time = now() WHERE uniqueid = $1", [request.cookies.uniqueID])
																	done();
																	//second page of instructions
																	response.render('pages/taskstart', {captchatext: ""});	
																}else{
																	//first page those from ads see
																	response.render('pages/index', {treatment: result.rows[0].treatment, split: result.rows[0].split});
																}
															}else{
																//user followed a referral link before the split had been decided
																response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
															}
														}
													});
												}
											}else{
												response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
											}
										}
									});
								}
							}
						}else{
							//cookie not set, make new user? from referral
							checkLimits(result, request, response, client, done, function(){
								//create new user
								client.query("INSERT INTO person (uniqueid, securecode, registrationtime, referrerid) VALUES (createuniqueid(), md5(random()::text), now(), $1) RETURNING uniqueid, securecode", [request.path.substring(1)], function(err, result) {
									//select treatment from treatment group by treatment order by count(treatment); if referrer is ad
									done();
									if (err){
										console.error(err); response.send("Error " + err);
									}else{
										//set root as parents root
										client.query("UPDATE person SET root = (SELECT root FROM person WHERE uniqueid = $1) WHERE uniqueid = $2", [request.path.substring(1), result.rows[0].uniqueid]);
										done();
										client.query("INSERT INTO activity (uniqueid, time) VALUES ($1, now())", [result.rows[0].uniqueid]])
										done();
										//set userid and secure cookies
										response.cookie('uniqueID', result.rows[0].uniqueid);
										response.cookie('sec', result.rows[0].securecode);
										response.redirect("/"+result.rows[0].uniqueid);
									}
								});
							});
						}
					}else{
						//id from address bar does not exist in the system
						response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
					}
				}
			});
		}
	});
});

var checkLimits = function(result, request, response, client, done, callback){
	//check if treatment limit not met
	client.query('SELECT count(*) FROM treatment WHERE uniqueid IN (SELECT uniqueid FROM person WHERE uniqueid<>root) AND treatment=(SELECT treatment FROM treatment WHERE uniqueid=$1)', [request.path.substring(1)], function(err, result) {
		done();
		if (err){
			console.error(err); response.send("Error " + err);
		}else{
			if(result.rows[0].count <= treatmentLimitFromReferrals){
				//check if tree limit not met for completed tasks
				client.query('SELECT count(*) FROM person JOIN task ON person.uniqueid=task.uniqueid WHERE root=(SELECT root FROM person WHERE uniqueid=$1) AND endtime IS NOT NULL', [request.path.substring(1)], function(err, result) {
					done();
					if (err){
						console.error(err); response.send("Error " + err);
					}else{
						if(!treeLimitOn || result.rows[0].count <= treeLimit){
							//check if tree limit not met for outstanding tasks
							client.query('SELECT count(*) FROM person JOIN activity ON person.uniqueid=activity.uniqueid WHERE root=(SELECT root FROM person WHERE uniqueid=$1) AND now()-time < interval '+reservedSlotTime, [request.path.substring(1)], function(err, result) {
								done();
								if (err){
									console.error(err); response.send("Error " + err);
								}else{
									if(!treeLimitOn || result.rows[0].count <= treeLimit){
										//check if referral limit not met for completed tasks
										client.query('SELECT count(*) FROM person JOIN task ON person.uniqueid=task.uniqueid WHERE referrerid=$1 AND endtime IS NOT NULL', [request.path.substring(1)], function(err, result) {
											done();
											if (err){
												console.error(err); response.send("Error " + err);
											}else{
												if(result.rows[0].count <= referralLimit){
													//check if referral limit not met for outstanding tasks
													client.query('SELECT count(*) FROM person JOIN activity ON person.uniqueid=activity.uniqueid WHERE referrerid=$1 AND now()-time < interval '+reservedSlotTime, [request.path.substring(1)], function(err, result) {
														done();
														if (err){
															console.error(err); response.send("Error " + err);
														}else{
															if(result.rows[0].count <= referralLimit){
																//check if still within referrers window of time to refer
																client.query('SELECT count(*) FROM task WHERE uniqueid=$1 AND now()-endtime < interval '+timeToRefer, [request.path.substring(1)], function(err, result) {
																	done();
																	if (err){
																		console.error(err); response.send("Error " + err);
																	}else{
																		if(result.rows[0].count > 0){
																			callback();
																		}else{
																			//referrers window expired
																			response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
																		}
																	}
																});
															}else{
																//referral limit reached for outstanding tasks														
																response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks at the moment. However, you can try and come back later when more may be available."});		
															}
														}
													});
												}else{
													//referral limit reached for completed tasks
													response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
												}
											}
										});
									}else{
										//tree limit reached for outstanding tasks
										response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks at the moment. However, you can try and come back later when more may be available."});						
									}
								}
							});
						}else{
							//tree limit reached for completed tasks
							response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});	
						}
					}
				});
			}else{
				//limit reached for total number of referrals
				response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});						
			}
		}
	});
}

var invokeAndProcessGoogleResponse = function(request, response, options, jar, callback){
	requests(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			//if google identifies as a human
			if(JSON.parse(body).success===true){
				pg.connect(process.env.DATABASE_URL, function(err, client, done) {
					var uniqueID = jar.getCookieString(options.url).split(";")[0].split("=")[1];
					var securecode = jar.getCookieString(options.url).split(";")[1].split("=")[1];
					//if the id and secure code are valid
					client.query('SELECT * FROM person WHERE uniqueid=$1 AND securecode=$2', [uniqueID, securecode], function(err, result) {
						done();
						if (err){
							console.error(err); response.send("Error " + err);
						}else{
							if(result.rows[0] !== undefined){
								//set the time of the accepted action 
								//TODO activity for users who have started? (same time as task time?) or just clicked 
								
								//initialise the task
								client.query("INSERT INTO task (uniqueid, starttime, quality, layout, initiallayout, x, y) VALUES ($1, now(), 0, $2, $2, 0, 0)", [uniqueID, startingPoints[Math.floor(Math.random() * 4)]]);
								done();
								client.query("INSERT INTO move (uniqueid, moves) VALUES ($1, $2)", [uniqueID, '{}']);
								done();
								client.query("UPDATE person SET ip=$1, useragent=$2 WHERE uniqueid=$3", [request.ip, request.headers['user-agent'], uniqueID]);
								//set treatment
								if(result.rows[0].referrerid===adcode){
									client.query("INSERT INTO treatment (uniqueid, treatment) VALUES ($1, (SELECT treatment FROM treatment WHERE uniqueid IN (SELECT root FROM person) OR uniqueid IS NULL GROUP BY treatment ORDER BY count(treatment) LIMIT 1)) RETURNING treatment", [uniqueID], function(err, result) {
										done();
										if (err){
											console.error(err); response.send("Error " + err);
										}else{
											if(result.rows[0].treatment === 0){
												client.query("INSERT INTO split (uniqueid, split, time) VALUES ($1, 50, now())", [uniqueID]);
												done();
											}else if(result.rows[0].treatment === 2){
												client.query("INSERT INTO split (uniqueid, split, time) VALUES ($1, 100, now())", [uniqueID]);
												done();
											}
										}
									});
								}else{
									client.query("INSERT INTO treatment (uniqueid, treatment) VALUES ($1, (SELECT treatment FROM treatment WHERE uniqueid=$2)) RETURNING treatment", [uniqueID, result.rows[0].referrerid], function(err, result) {
										done();
										if (err){
											console.error(err); response.send("Error " + err);
										}else{
											if(result.rows[0].treatment === 0){
												client.query("INSERT INTO split (uniqueid, split, time) VALUES ($1, 50, now())", [uniqueID]);
												done();
											}else if(result.rows[0].treatment === 2){
												client.query("INSERT INTO split (uniqueid, split, time) VALUES ($1, 100, now())", [uniqueID]);
												done();
											}
										}
									});
								}
							}
						}
					});
				});
			}
			callback(JSON.parse(body).success);
		}
	});
}

app.post('/accept', function(request, response) {
	// Set the headers
	var headers = {
		'User-Agent':       'Super Agent/0.0.1',
		'Content-Type':     'application/x-www-form-urlencoded'
	}

	//add cookies to a jar
	var jar = requests.jar();
	var cookie1 = requests.cookie('uniqueid='+request.cookies.uniqueID);
	var cookie2 = requests.cookie('securecode='+request.cookies.sec);
	jar.setCookie(cookie1, 'https://www.google.com/recaptcha/api/siteverify');
	jar.setCookie(cookie2, 'https://www.google.com/recaptcha/api/siteverify');
	
	// Configure the request
	var options = {
		url: 'https://www.google.com/recaptcha/api/siteverify',
		method: 'POST',
		headers: headers,
		form: {'secret': captchakey, 'response': request.body['g-recaptcha-response']},
		jar: jar
	}
	
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//check if IP limit not exceeded
		client.query('SELECT * FROM person WHERE ip=$1', [request.ip], function(err, result) {
			done();
			if (err){
				console.error(err); response.send("Error " + err);
			}else{
				if(result.rows.length <= ipLimit){
					invokeAndProcessGoogleResponse(request, response, options, jar, function(human){
						if(!human){
							response.render('pages/taskstart', {captchatext: "Please fill in the CAPTCHA to proceed"});								
						}else{
							response.redirect("/"+request.cookies.uniqueID);
						}
					});
				}else{
					//show ip limit reached page
					response.render('pages/text', {text: "Sorry, we are no longer looking for people to complete tasks."});
				}
			}
		});
	});
});

app.post('/move', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//retrieve moves already made
		client.query('SELECT moves FROM move WHERE uniqueid=(SELECT uniqueid FROM person where uniqueid=$1 AND securecode=$2)', [request.cookies.uniqueID, request.cookies.sec], function(err, result) {
			done();
			if (err){
				console.error(err); response.send("Error " + err);
			}else{
				if(result.rows[0] !== undefined){
					//update x, y location
					if(request.body.move === 'u'){
						client.query("UPDATE task SET y = y + 1 WHERE uniqueid=$1", [request.cookies.uniqueID]);
						done();
					}
					if(request.body.move === 'd'){
						client.query("UPDATE task SET y = y - 1 WHERE uniqueid=$1", [request.cookies.uniqueID]);
						done();
					}
					if(request.body.move === 'l'){
						client.query("UPDATE task SET x = x - 1 WHERE uniqueid=$1", [request.cookies.uniqueID]);
						done();
					}
					if(request.body.move === 'r'){
						client.query("UPDATE task SET x = x + 1 WHERE uniqueid=$1", [request.cookies.uniqueID]);
						done();
					}
					//update the board if the user wishes to leave and return
					var newMoves = JSON.parse(result.rows[0].moves);
					newMoves[new Date().toString()] = request.body.move;
					client.query("UPDATE task SET layout = $1, quality = quality + 1 WHERE uniqueid=$2", [request.body.layout, request.cookies.uniqueID]);
					done();
					//add the new move
					client.query("UPDATE move SET moves = $1 WHERE uniqueid = ((SELECT uniqueid FROM task WHERE uniqueid=$2))", [newMoves, request.cookies.uniqueID]);
					done();
				}
			}
		});
		response.send("Done");
	});
});

app.post('/reset', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//retrieve moves made so far
		client.query('SELECT moves FROM move WHERE uniqueid=(SELECT uniqueid FROM person where uniqueid=$1 AND securecode=$2)', [request.cookies.uniqueID, request.cookies.sec], function(err, result) {
			done();
			if (err){
				console.error(err); response.send("Error " + err);
			}else{
				if(resut.rows[0] !== undefined){
					var newMoves = JSON.parse(result.rows[0].moves);
					newMoves[new Date().toString()] = 'reset';
					//reset the board to the initial layout and initial x,y coordinates
					client.query("UPDATE task SET layout = initiallayout, quality = quality + 1, x = 0, y = 0 WHERE uniqueid=$1", [request.cookies.uniqueID]);
					done();
					//add the reset move
					client.query("UPDATE move SET moves = $1 WHERE uniqueid=$2", [newMoves, request.cookies.uniqueID]); //request.cookies.sec,
					done();
				}
			}
		});
		response.redirect("/"+request.cookies.uniqueID);
	});
});

app.post('/complete', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		client.query('SELECT * FROM person JOIN task ON person.uniqueid=task.uniqueid JOIN treatment ON person.uniqueid=treatment.uniqueid WHERE person.uniqueid=(SELECT uniqueid FROM person WHERE uniqueid=$1 AND securecode=$2)', [request.cookies.uniqueID, request.cookies.sec], function(err, result) {
			done();
			if (err){
				console.error(err); response.send("Error " + err);
			}else{
				if(result.rows[0] !== undefined){
					//allocate the voucher code and mark the task as completed
					if(result.rows[0].referrerid !== adcode && result.rows[0].treatment !== 2){
						if(request.cookies.optOutOfBonus !== undefined){
							client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 0 AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
							done();
						}else{
							client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 100-(SELECT split FROM split WHERE uniqueid=(SELECT referrerid FROM person WHERE uniqueid=$1)) AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
							done();
						}
						client.query("UPDATE currentbudget SET treatment"+result.rows[0].treatment+" = treatment"+result.rows[0].treatment+"-1, task = task-1, referral = referral-1, total = total-1");
						done();
					}else{
						client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 0 AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
						done();
						client.query("UPDATE currentbudget SET treatment"+result.rows[0].treatment+" = treatment"+result.rows[0].treatment+"-1, task = task-1, total = total-1");
						done();
					}
					client.query("INSERT INTO budget SELECT * FROM currentbudget, now()");
					done();
				}
				client.query("UPDATE task SET endtime=now(), totaltime=age(now(), (SELECT starttime FROM task WHERE uniqueid=$1)) WHERE uniqueid=$1", [request.cookies.uniqueID], function(err, result) {
					done();
					if (err){
						console.error(err); response.send("Error " + err);
					}else{
						response.redirect("/"+request.cookies.uniqueID);
					}
				});
			}
		});
	});
});

app.post('/button', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//add the button click to the database
		client.query("INSERT INTO button VALUES ((SELECT uniqueid FROM person WHERE uniqueid=$1 AND securecode=$2), $3, now())", [request.cookies.uniqueID, request.cookies.sec, request.body.button]);
		done();
		response.send("Done");
	});
});

app.post('/email', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//add the email to the database
		client.query("INSERT INTO email VALUES ((SELECT uniqueid FROM person WHERE uniqueid=$1 AND securecode=$2), $3, now(), false)", [request.cookies.uniqueID, request.cookies.sec, request.body.inputEmail]);
		done();
		response.redirect("/"+request.cookies.uniqueID);
	});
});

app.post('/seen', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		client.query('UPDATE email SET seen = true WHERE uniqueid=(SELECT uniqueid FROM person WHERE uniqueid=$1 AND securecode=$2)', [request.cookies.uniqueID, request.cookies.sec]);
		done();
		response.send("Done");
	});
});

app.post('/split', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		//add split decision to database
		client.query('INSERT INTO split VALUES ($1, $2, now())', [request.cookies.uniqueID, request.body.split]);
		done();
		response.redirect("/"+request.cookies.uniqueID);
	});
});

app.post('/nextinstructions', function(request, response) {
	if(request.body.bonus !== undefined){
		response.cookie('optOutOfBonus', true);
	}
	response.cookie('ins', true);
	response.redirect("/"+request.cookies.uniqueID);
});

app.get('/skip', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		client.query('SELECT * FROM person JOIN task ON person.uniqueid=task.uniqueid JOIN treatment ON person.uniqueid=treatment.uniqueid WHERE person.uniqueid=(SELECT uniqueid FROM person WHERE uniqueid=$1 AND securecode=$2)', [request.cookies.uniqueID, request.cookies.sec], function(err, result) {
			done();
			if (err){
				console.error(err); response.send("Error " + err);
			}else{
				if(result.rows[0] !== undefined){
					//allocate the voucher code and mark the task as completed
					if(result.rows[0].referrerid !== adcode && result.rows[0].treatment !== 2){
						if(request.cookies.optOutOfBonus !== undefined){
							client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 0 AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
							done();
						}else{
							client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 100-(SELECT split FROM split WHERE uniqueid=(SELECT referrerid FROM person WHERE uniqueid=$1)) AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
							done();
						}
						client.query("UPDATE currentbudget SET treatment"+result.rows[0].treatment+" = treatment"+result.rows[0].treatment+"-1, task = task-1, referral = referral-1, total = total-1");
						done();
					}else{
						client.query("UPDATE voucher SET uniqueid=$1 WHERE vouchercode = (SELECT vouchercode FROM voucher WHERE extra = 0 AND uniqueid IS NULL LIMIT 1)", [request.cookies.uniqueID]);
						done();
						client.query("UPDATE currentbudget SET treatment"+result.rows[0].treatment+" = treatment"+result.rows[0].treatment+"-1, task = task-1, total = total-1");
						done();
					}
					client.query("INSERT INTO budget SELECT * FROM currentbudget, now()");
					done();
				}
				client.query("UPDATE task SET endtime=now(), totaltime=age(now(), (SELECT starttime FROM task WHERE uniqueid=$1)) WHERE uniqueid=$1", [request.cookies.uniqueID], function(err, result) {
					done();
					if (err){
						console.error(err); response.send("Error " + err);
					}else{
						response.redirect("/"+request.cookies.uniqueID);
					}
				});
			}
		});
	});
});

app.get('/fillvoucher', function(request, response) {
	pg.connect(process.env.DATABASE_URL, function(err, client, done) {
		for(var i = 0; i<100; i++){
			var prefix = '';
			if(i<1000){
				prefix = '0';
			}
			if(i<100){
				prefix = '00';
			}
			if(i<10){
				prefix = '000';
			}
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D30-"+prefix+i+"', 1.00, 0)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D31-"+prefix+i+"', 1.10, 10)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D32-"+prefix+i+"', 1.20, 20)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D33-"+prefix+i+"', 1.30, 30)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D34-"+prefix+i+"', 1.40, 40)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D35-"+prefix+i+"', 1.50, 50)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D36-"+prefix+i+"', 1.60, 60)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D37-"+prefix+i+"', 1.70, 70)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D38-"+prefix+i+"', 1.80, 80)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D39-"+prefix+i+"', 1.90, 90)");//, request.cookies.sec]);
			done();
			client.query("INSERT INTO voucher (vouchercode, value, treatment) VALUES ('V0UC-H3RC-0D40-"+prefix+i+"', 2.00, 100)");//, request.cookies.sec]);
			done();
		}
		response.redirect("/"+request.cookies.uniqueID);
	});
});

app.listen(app.get('port'), function() {
	console.log('Node app is running on port', app.get('port'));
});