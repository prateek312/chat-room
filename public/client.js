// Livestamp.js / v1.1.2 / (c) 2012 Matt Bradley / MIT License
(function(d,g){var h=1E3,i=!1,e=d([]),j=function(b,a){var c=b.data("livestampdata");"number"==typeof a&&(a*=1E3);b.removeAttr("data-livestamp").removeData("livestamp");a=g(a);g.isMoment(a)&&!isNaN(+a)&&(c=d.extend({},{original:b.contents()},c),c.moment=g(a),b.data("livestampdata",c).empty(),e.push(b[0]))},k=function(){i||(f.update(),setTimeout(k,h))},f={update:function(){d("[data-livestamp]").each(function(){var a=d(this);j(a,a.data("livestamp"))});var b=[];e.each(function(){var a=d(this),c=a.data("livestampdata");
  if(void 0===c)b.push(this);else if(g.isMoment(c.moment)){var e=a.html(),c=c.moment.fromNow();if(e!=c){var f=d.Event("change.livestamp");a.trigger(f,[e,c]);f.isDefaultPrevented()||a.html(c)}}});e=e.not(b)},pause:function(){i=!0},resume:function(){i=!1;k()},interval:function(b){if(void 0===b)return h;h=b}},l={add:function(b,a){"number"==typeof a&&(a*=1E3);a=g(a);g.isMoment(a)&&!isNaN(+a)&&(b.each(function(){j(d(this),a)}),f.update());return b},destroy:function(b){e=e.not(b);b.each(function(){var a=
  d(this),c=a.data("livestampdata");if(void 0===c)return b;a.html(c.original?c.original:"").removeData("livestampdata")});return b},isLivestamp:function(b){return void 0!==b.data("livestampdata")}};d.livestamp=f;d(function(){f.resume()});d.fn.livestamp=function(b,a){l[b]||(a=b,b="add");return l[b](this,a)}})(jQuery,moment);
//Application code
$(document).ready(function() {
	//socket instance
	var socket = new WebSocket('wss://localhost:8080/'); //Use localhost (to test only on your browsers) or your machine IP to test witin a network
	// var socket = new WebSocket('ws://fakelocalhost.me:8080/');
	//current user refrence
	var user = {id: null, name: "No Name"};
	//chat messages container template
	var chat_area = '<div class="chat_area"></div>';
	//chat message wrapper
	var chat_area_m = '<div class="chat_area_msg"><div class="chat_area_msg_head" ><span class="name" ></span><span class="ts" ></span></div><div class="hr"></div><div class="chat_area_msg_body"></div></div>';
	//chat windows container
	var chat_w = {};
	var jspanelStart;
	/**
	* Fast UUID generator, RFC4122 version 4 compliant.
	* @author Jeff Ward (jcward.com).
	* @license MIT license
	* @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
	**/
	var UUID = (function() {
		var self = {};
		var lut = []; for (var i=0; i<256; i++) { lut[i] = (i<16?'0':'')+(i).toString(16); }
		self.generate = function() {
			var d0 = Math.random()*0xffffffff|0;
			var d1 = Math.random()*0xffffffff|0;
			var d2 = Math.random()*0xffffffff|0;
			var d3 = Math.random()*0xffffffff|0;
			return lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
			lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
			lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
			lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
		}
		return self;
	})();
	
	socket.onopen = function(event) {
		log('Opened connection from client');
	}

	socket.onerror = function(event) {
		log('Error: ' + JSON.stringify(event));
	}
	//socket onmessage listener
	socket.onmessage = function (event) {
		try {
			var d = JSON.parse(event.data) || {};
			switch(d.type) {
				case "userIdUpdate" :
					user.id = d.id;
					break;
				case "broadcast" :
					var html = "";
					$("#active_users_cn").html(d.total);
					$.each(d.clients_arr, function(i, val) {
						var dis = (val.id == user.id) ? "disabled" : "", dis_others = "";
						if(!dis) {
							if(Object.keys(chat_w).indexOf(val.id) >= 0) {
								dis_others = "disabled";
							}
						}
						var you = (val.id == user.id) ? " (Its You)" : "";
						var tooltip = you ? 'data-toggle="tooltip" data-placement="top" title="Click here to edit your name"' : "";
						var ucls = you ? "currentUser" : "";
						html += '<li class="list-group-item '+ucls+'" data-userid="'+val.id+'" data-username="'+val.name+'"><span '+tooltip+'><strong>'+val.name+you+'</strong></span><button class="btn btn-primary btn-sm leftsp" '+dis+' '+dis_others+'>Chat</button></li>';
					});
					$("#active_users").html(html);
					$('#active_users li.currentUser span').tooltip();
					break;
				case "userDisconnected" :
					if(chat_w[d.id]) {
						chat_w[d.id].panel.close();
						delete chat_w[d.id];
					}
					break;
				case "chatRoomMessageBroadcast" :
					$(chat_area_m).find(".name").html(d.name).end().find(".ts").attr("data-livestamp", d.time).end().find(".chat_area_msg_body").html(d.message).end().appendTo($(".app_panel_body .chat_area"));
					$(".app_panel_body").scrollTop($(".app_panel_body").get(0).scrollHeight);
					break;
				case "msgToUser" :
					var from_user = d.from_user;
					if(chat_w[from_user]) {
						$(chat_area_m).find(".name").html(d.name).end().find(".ts").attr("data-livestamp", d.time).end().find(".chat_area_msg_body").html(d.message).end().appendTo(chat_w[from_user].panel.content.find(".chat_area"));
						$(chat_w[from_user].panel.content).scrollTop(chat_w[from_user].panel.content.get(0).scrollHeight);
					} else {
						var cpanel = $.jsPanel({
							container: 'body',
							headerControls: {controls: "closeonly"},
							draggable: false,
							position: {my: "right-bottom", at: "right-bottom", offsetX: setOffsetX, offsetY: setOffsetY},
							headerTitle: d.name.toUpperCase(),
							content: chat_area,
							contentSize:  { width: 300, height: 200 },
							theme: "bootstrap-primary",
							contentOverflow: 'auto',
							onclosed: function() {
								delete chat_w[from_user];
							},
							footerToolbar: [
								{
									item: '<input type="text" class="form-control chat_input" placeholder="Enter some text">'
								},
								{
									item: "<button style='margin-left:5px;' type='button'><span class='...'></span></button>",
									event: "click",
									btnclass: "btn btn-primary btn-sm",
									btntext: "Send",
									callback: sendChatMessage.bind(null,{id:from_user,name:d.name})
								}
							]
						});
						$(chat_area_m).find(".name").html(d.name).end().find(".ts").attr("data-livestamp", d.time).end().find(".chat_area_msg_body").html(d.message).end().appendTo(cpanel.content.find(".chat_area"));
						$(cpanel.content).scrollTop(cpanel.content.get(0).scrollHeight);
						cpanel.content.parent().find(".chat_input").on("keypress", function(e) {
							if(e.keyCode == 13) {
								sendChatMessage({id:from_user,name:d.name},{data:cpanel});
							}
						});
						chat_w[from_user] = {
							panel: cpanel
						}
					}
					break;
				default :
				log(event.data);
			}
		} catch(e) {
			console.log(e.message);
		}
	}
	//socket onclose listener
	socket.onclose = function(event) {
		log('Closed connection from server/client');
		$("body").empty();
		var panel = $.jsPanel({
			container: 'body',
			paneltype: 'modal',
			headerTitle: "Server Disconnected",
			content: '<p><strong>Connection lost to server.</strong></p>',
			contentSize:  { width: 200, height: 100 },
			theme: "bootstrap-warning"
		});
	}

	window.addEventListener('beforeunload', function() {
		socket.close();
	});
	
	//Chat button handler
	$(document).on("click", "#active_users li button", function(e) {
		var li = $(this).parent();
		var name = li.attr("data-username"), id = li.attr("data-userid");
		$(this).prop("disabled", true);
		var cpanel = $.jsPanel({
			container: 'body',
			headerControls: {controls: "closeonly"},
			draggable: false,
			position: {my: "right-bottom", at: "right-bottom", offsetX: setOffsetX, offsetY: setOffsetY},
			headerTitle: name.toUpperCase(),
			content: chat_area,
			contentSize:  { width: 300, height: 200 },
			theme: "bootstrap-primary",
			contentOverflow: 'auto',
			onclosed: function() {
				delete chat_w[id];
			},
			footerToolbar: [
				{
					item: '<input type="text" class="form-control chat_input" placeholder="Enter some text">'
				},
				{
					item: "<button style='margin-left:5px;' type='button'><span class='...'></span></button>",
					event: "click",
					btnclass: "btn btn-primary btn-sm",
					btntext: "Send",
					callback: sendChatMessage.bind(null,{id:id,name:name})
				}
			]
		});
		cpanel.content.parent().find(".chat_input").on("keypress", function(e) {
			if(e.keyCode == 13) {
				sendChatMessage({id:id,name:name},{data:cpanel});
			}
		});
		chat_w[id] = {
			panel: cpanel
		}
	});
	
	//Send chat message to a specific user, used as a callback
	function sendChatMessage(targetUser, event) {
		var m = event.data.content.parent().find('.chat_input').val() || "No Input", json;
		var time = Math.floor(+new Date / 1000);
		$(chat_area_m).find(".name").html(user.name).end().find(".ts").attr("data-livestamp", time).end().find(".chat_area_msg_body").html(m).end().appendTo(event.data.content.find(".chat_area"));
		$(event.data.content).scrollTop(event.data.content.get(0).scrollHeight);
		event.data.content.parent().find('.chat_input').val("");
		json = {
			type: "msgFromUser",
			to_user: targetUser.id,
			from_user: user.id,
			message: m,
			time: time
		}
		socket.send(JSON.stringify(json));
	}
	
	//Log function
	function log(text) {
		if($("#log ul li").length > 200) {
			$("#log ul").empty();
		}
		$("#log ul").append("<li class='list-group-item'>"+text+"</li>");
	}
	
	//Show Logs click handler
	var show_logs_panel = false;
	$(document).on("click", "#show_logs", function() {
		if(show_logs_panel) {
			return;
		}
		var timer = null, startTimer = function() {
			timer = setInterval(reload,1000);
		}
		var panel = $.jsPanel({
			container: 'body',
			headerTitle: "Application Logs",
			content: $("#log").html(),
			contentSize:  { width: 500, height: 300 },
			theme: "bootstrap-primary",
			contentOverflow: 'auto',
			onclosed: function() {
				if(timer) {
					clearInterval(timer);
					console.log("Timer :" +timer+ " Is cleared");
				}
				show_logs_panel = false;
			}
		});
		function reload() {
			panel.content.empty();
			panel.content.append($("#log").html());
		}
		startTimer();
		show_logs_panel = true;
	});
	//Page load form for getting username
	function userForm(name) {
		jspanelStart = $.jsPanel({
			container: 'body',
			paneltype: 'modal',
			headerTitle: "Enter Your Name",
			content: '<form class="form-inline" onsubmit="return false;"><div class="form-group"><label for="exampleInputName2">Name : </label><input type="text" class="form-control name_input leftsp" id="exampleInputName2" placeholder="Jane Doe"></div><button class="btn btn-primary leftsp" id="name_input_btn">Submit</button></form>',
			contentSize:  { width: 400, height: 100 },
			theme: "bootstrap-primary",
			callback: function() {
				this.content.find(".name_input").val(name ? user.name : "").focus();
			},
			onclosed: function(e) {
				jspanelStart && (jspanelStart = null);
			}
		});
	}
	userForm();
	//User form modal button handler
	$(document).on("click", "#name_input_btn", function(e) {
		if(!$(this).parent().find("input").val()) {
			alert("Please enter your name");
			return false;
		}
		var data = JSON.stringify({ type: "nameUpdate", username: $(this).parent().find("input").val() });
		user.name = $(this).parent().find("input").val();
		$("title").text(user.name.toUpperCase() + " | WebSocket Chat Application");
		log("Username value updated at "+moment().format('MMMM Do YYYY, h:mm:ss A')+", new value : " + user.name);
		socket.send(data);
		jspanelStart && jspanelStart.close();
	});
	
	$(document).on("click", "#active_users li.currentUser span", userForm.bind(null,true));
	
	function setOffsetX() {
		//todo refactor this function
		var w = Object.keys(chat_w);
		if(!w.length) {
			return "5px";
		}
		return '-' + (w.length * 300) + 'px';
		//return 0;
	}
	
	function setOffsetY() {
		return 0;
	}
	
	function adjustPanelsHeight() {
		var w = $(window).width(), h = $(window).height(), pb = $('.app_panel_body'), pu = $('.app_users'), pc = $('.app_chat_rooms'); h = h - 130;
		var css1 = {'min-height':'200px','max-height':'300px','overflow':'auto'},
			css2 = {'min-height':h+'px','max-height':h+'px','overflow':'auto'};
		w <= 768 ? (pb.css(css1),pu.css(css1),pc.css(css1),$('#btnSendMsg').css("float","none"),
		$('#p_msg').css("width",($('#p_msg').closest("form").width()-70)+"px"),$('body').css("overflow","auto")) : 
		(pb.css(css2), pu.css({'min-height':(h/2-4)+'px','max-height':(h/2-4)+'px','overflow':'auto'}),
		pc.css({'min-height':(h/2-4)+'px','max-height':(h/2-4)+'px','overflow':'auto'}),$('#btnSendMsg').css("float","right"),
		$('#p_msg').css("width",($('#p_msg').closest("form").width()-70)+"px"),$('body').css("overflow","hidden"));
	}
	adjustPanelsHeight();
	$(window).on("resize", adjustPanelsHeight);
	
	
	$(document).on("click", "#btnSendMsg", handleChatRoomMessage);
	
	function handleChatRoomMessage(e) {
		e.preventDefault();
		var f = $(this).closest("form"), v = f.find('input').val();
		if(!v) {
			f.find(".form-group").addClass("has-error");
			f.find("input").off("focus").one("focus", function() {
				$(this).parent().hasClass("has-error") && $(this).parent().removeClass("has-error");
			});
			return;
		}
		var time = Math.floor(+new Date / 1000), json;
		$(chat_area_m).find(".name").html(user.name).end().find(".ts").attr("data-livestamp", time).end().find(".chat_area_msg_body").html(v).end().appendTo($(".app_panel_body .chat_area"));
		$(".app_panel_body").scrollTop($(".app_panel_body").get(0).scrollHeight);
		f.find('input').val("");
		f.find(".form-group").hasClass("has-error") && f.find(".form-group").removeClass("has-error");
		json = {
			type: "chatRoomMessage",
			from_user: user.id,
			message: v,
			time: time
		}
		socket.send(JSON.stringify(json));
	}
	
	$(document).on("click", "#create-chat-room", createChatRoom);
	
	function createChatRoom(e) {
		jspanelStart = $.jsPanel({
			container: "body",
			paneltype: 'modal',
			headerTitle: "Create Chat Room",
			content: '<form class="form-inline" onsubmit="return false;"><div class="form-group"><input type="text" class="form-control" id="crinput" placeholder="Enter a name for chat room"></div><button type="submit" class="btn btn-primary leftsp" id="btnCreateChatRoom" style="vertical-align:top;">Create</button></form>',
			contentSize:  { width: 323, height: 100 },
			theme: "bootstrap-primary",
			callback: function() {
				this.content.find("#crinput").val("").focus();
			},
			onclosed: function(e) {
				jspanelStart && (jspanelStart = null);
			}
		});
	}
	
	$(document).on("click", "#btnCreateChatRoom", function() {
		var b = $(this), json, id = '_' + UUID.generate(), v = $('#crinput').val(), msg;
		if(!v || v.length > 30) {
			msg = !v ? "Room name is required" : "Room name must be less than 30 char.";
			$('#crinput').parent().append('<p class="help-block">'+msg+'</p>');
			$('#crinput').parent().addClass("has-error").end().off("focus").one("focus", function() {
				$(this).parent().hasClass("has-error") && $(this).parent().removeClass("has-error");
				$(this).parent().find("p").length && $(this).parent().find("p").remove();
			});
			return;
		}
		b.attr("disabled", true);
		json = {
			type: "actionCreateChatRoom",
			id: id,
			name: v,
			creator: user.id
		};
		$('#active_chat_rooms').prepend('<li class="list-group-item" data-id="'+id+'" data-creator="'+user.id+'"><b>'+v+'</b><span class="glyphicon glyphicon-plus leftsp joinroom" style="float:right;cursor:pointer;" title="Join Room" data-toggle="tooltip" data-placement="left"></span><span class="glyphicon glyphicon-trash deleteroom" style="float:right;cursor:pointer;" title="Delete Room" data-toggle="tooltip" data-placement="left"></span></li>');
		$('#active_chat_rooms li:first span').tooltip();
		jspanelStart && jspanelStart.close();
	});
	
	$(document).on("click", "span.joinroom", function() {
		var li = $(this).closest("li");
		$(this).tooltip('hide');
		li.addClass("active");
		$(this).replaceWith('<span class="glyphicon glyphicon-off leftsp leaveroom" style="float:right;cursor:pointer;" title="Leave Room" data-toggle="tooltip" data-placement="left"></span>');
		li.find(".leaveroom").tooltip();
	});
	
	$(document).on("click", "span.leaveroom", function() {
		var li = $(this).closest("li");
		$(this).tooltip('hide');
		li.removeClass("active");
		$(this).replaceWith('<span class="glyphicon glyphicon-plus leftsp joinroom" style="float:right;cursor:pointer;" title="Join Room" data-toggle="tooltip" data-placement="left"></span>');
		li.find(".joinroom").tooltip();
	});
});
