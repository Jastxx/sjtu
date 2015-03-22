$(function(){
    var user = localStorage.getItem('sjtu');
    if(user){
        doLogin(user);
    }


    var term = '';//学期
    var course = [];//课程
    var userid;//学号

    var clearFresh = false;//清楚定时
    var invPJ;//定时
    var comSuc = 0;//评价成功
    var comNum = 0;//待评价

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



    function doLogin(s){
        var p;
        if(s != null)
            p = s;
        else
            p = $('#xx').serialize();
        $('#xx').hide();
        $('#loginInfo').html('正在登录..............');
        $.post('http://www.onlinesjtu.com/learningspace/learning/enter.asp',p,function(d){
            $('#loginInfo').html('');
            $('#xx').show();
            if(d.indexOf('错误！')>-1){
                alert('用户名或密码错误！');
                return false;
            }
            if(s == null && $('#auto')[0].checked){
                localStorage.setItem('sjtu',p);
            }
            userid = p.match(new RegExp("userid=([^\&]+)","i"))[1].replace('userid=');
            var str = "姓名：" + d.match(new RegExp("realname=([^\&]+)","i"))[1].replace('realname=') + "  学号：" + userid ;
            str+='   <input type="button" id="logout" value="退出"/>';
            $('#xx').html(str);
            $('#logout').click(logout);
            kaoqin();
        });

    }

    function logout(){
        localStorage.clear();
        if(localStorage.getItem('sjtu') == null){
            location.reload();
        }

    }



    function kaoqin(){
        appendInfo('===================解析课程===================',1);
        $.get('http://www.onlinesjtu.com/learningspace/learning/student/kaoqin_list.asp',function(d){
            var reg_kc = new RegExp("courseid=([^\&]+)","i");
            var trs = $(d).find('tr');
            $.each(trs,function(i,t){
                var code = $(t).html();
                if(code.indexOf('courseid=')>-1){
                    var kc={};
                    kc.id=code.match(reg_kc)[1];
                    kc.name=$(t).find('td:eq(0)').text().replace(/ /g,'');
                    kc.url=$(t).find('a').last()[0].href;
                    course.push(kc);
                    if(term=='')
                        term = kc.url.match(new RegExp("term_identify=([^\&]+)","i"))[1].replace('term_identify=')
                    appendInfo("《"+kc.name+"》：<label id='zuoye_"+kc.id+"'></label><label id='zongping_"+kc.id+"'></label>");
                }
                if(i+1 == trs.length)
                    homework();
            });
            valQian();

        },'html');
    }


// 验证签到
    var weekTime =8*24*3600*1000;
    var url_kaoqin = 'http://www.onlinesjtu.com/learningspace/learning/student/kaoqinquery/kaoqin_list.asp?';
    function valQian(){
        appendInfo('===================查询签到情况===================',1);
        var ye = new Date().getFullYear();
        var runDown = false;
        $.each(course,function(i,kc){
            $.get(url_kaoqin+"courseid="+kc.id+"&term_identify="+term,function(d){
                var x =delCode(d);
                var tdArr = $(x).find('table:eq(1) tr:eq(1) td').slice(1);
                kc.downstatus=tdArr.eq(5).find('img').attr('xrc').indexOf('hook')>-1;//已下载
                var qCom = tdArr.last().text();//是否点评
                kc.comUrl=tdArr.last().find('a')[0].href;//点评页url
                kc.qDay = tdArr.eq(0).text();//课程日期
                var vTime = new Date(kc.qDay).getTime() + weekTime;
                kc.qianUse = qCom=='未填写' && vTime > new Date().getTime();//是否可签
                var expire = qCom=='未填写' && vTime < new Date().getTime();//已过期
                appendInfo("<label style='color:"+(kc.qianUse?"red":'')+"'>《" + kc.name + "》：" + kc.qDay + " - "+(kc.downstatus?'已签到':'未签到')+" - " + qCom + "评价" + (expire?'（已过期）':'') + '</label>');

                var zp = x.substr(x.indexOf('有效期'),23).replace("有效期：","").replace("）","").split("～");
                if(new Date(zp[0]) > new Date())
                    $('#zongping_'+kc.id).html("  <span title='"+zp.toString()+"'>总评:未开始</span>");
                else{
                    validateZP(kc.id,zp.toString());
                }
                if(kc.qianUse)
                    comNum++;
                if(kc.qianUse && !kc.downstatus)
                    runDown = true;
                if(i+1 == course.length){
                    if(runDown && dianBo())
                        setInvPing();
                    else{
                        //chrome.notifications.create('',{type:'basic',iconUrl:'',title:'签到课程',message:'全部已下载，无需再次点播'},function(){})
                        appendInfo('==============全部已下载，无需再次点播=============',1);
                        if(comNum>0)
                            setInvPing();
                    }

                }
            });
        });
    }

//验证是否评价
    function validateZP(cid,day){
        var url = 'http://218.1.73.12/PingJia/Default.aspx?sid='+userid+'&cid='+cid+'&ct=&term='+term;
        $.get(url,function(d){
            var st = $(d).find('#lbstr').text();
            if(st=='学期总评'){
                $('#zongping_'+cid).html("  <span title='"+day+"'>总评:<a class='pj' href='javascript:'>[评价]</a></span>");
                $('#zongping_'+cid + ' a').click(function(){
                    zongping(cid);
                });
            }

            else if(st=='已提交')
                $('#zongping_'+cid).html("  <span title='"+day+"'>总评:已评价");
            else
                $('#zongping_'+cid).html("  <span title='"+day+"'>总评:未评价（已过期）");
        });

    }

//循环检测评价
    function setInvPing(){
        appendInfo('===================进行评价===================',1);
        invPJ = setInterval(pingjia,10000);
        invSS = setInterval(freshSS,1000);
    }


//点播  
    var url_downlist = 'http://www.onlinesjtu.com/learningspace/learning/student/downloadlist.asp';
    var url_down = 'http://www.onlinesjtu.com/learningspace/learning/student';
    function dianBo(){
        appendInfo('===================点播签到===================',1);
        $.each(course,function(i,kc){
            if(kc.qianUse && !kc.downstatus){
                $.get(url_downlist+"?term_identify="+term+"&userid="+userid+"&courseid="+kc.id,function(x){
                    //var x =delCode(d,1);
                    var trArr = $(x).find('tr');
                    for(var i= trArr.length-1;i>=0;i--){
                        var td = trArr.eq(i).find('td');
                        if(td.eq(2).text()==kc.qDay){
                            var url = td.eq(0).find('a:eq(1)')[0].href.replace("chrome-extension://");
                            url = url_down + url.substr(url.indexOf('/'));
                            appendInfo(kc.name+"："+kc.qDay+"-"+td.eq(1).text() +  '-已签到');
                            reqUrl(url);
                        }else{
                            break;
                        }
                    }
                },'html');
            }
        });
        return true;
    }


    var invSS;
    var runSS = false;
//评价秒数刷新
    function freshSS(){
        if(!runSS)
            return false;
        $.each($('.ss'),function(i,t){
            var val = parseInt($(t).text());
            if(val > 0)
                $(t).text(val-1);
        });
    }

//评价

    function pingjia(){
        runSS = true;
        $.each(course,function(i,t){
            if(t.qianUse){
                //	++comNum;
                var url_pingjia = 'http://218.1.73.12/PingJia/Default.aspx?sid='+userid+'&cid='+t.id+'&ct='+t.qDay+'&term='+term;
                $.get(url_pingjia,function(d){
                    if($('#pj_'+t.id).length==0)
                        appendInfo('《'+t.name+'》：<label id="pj_'+t.id+'"></label><label id="wait_'+t.id+'"></label>');
                    if(d.indexOf('考勤') > -1) {
                        $('#pj_'+t.id).css('color','green').text('可评价');
                        $('#wait_'+t.id).text("评价中...");
                        pjSubmit(d,url_pingjia,t.id);
                        t.qianUse = false;
                    }else{
                        $('#pj_'+t.id).css('color','red').text('未下载');
                        $('#wait_'+t.id).html("（<label class='ss'>10</label>秒后刷新）");
                    }
                },'html');
            }

        });
    }

//提交评价
    function pjSubmit(obj,url,cid){
        if(!$(obj).find('#gvquestion_ctl02_rblscore_4')[0].disabled){
            var sel = $(obj).find('#ddlcourse')[0];
            var tec = sel.options[sel.selectedIndex].text.substr(0,1);
            var param = $(obj).eq(4).serializeArray();
            param[param.length-1].value='感谢' + tec + '老师！';
            param.push({name:"btsubmit",value:"提交评价"});
            param.push({name:"gvquestion$ctl02$rblscore",value:"5"});
            param.push({name:"gvquestion$ctl03$rblscore",value:"5"});
            param.push({name:"gvquestion$ctl04$rblscore",value:"5"});
            param.push({name:"gvquestion$ctl05$rblscore",value:"5"});
            param.push({name:"gvquestion$ctl06$rblscore",value:"5"});
            param.push({name:"rblcomment",value:"1"});
            $.post(url,param,function(d){
                if(d.indexOf('成功')>-1){
                    comSuc++;
                    $('#wait_'+cid).text("（点评成功！）");
                }
                if(comNum == comSuc){
                    clearInterval(invSS);
                    clearInterval(invPJ);
                }
            },'html')
        }
    }


//插入信息
    function appendInfo(info,t){
        if(t==1)
            $('#info').append('<p align="center">'+info+'</p>');
        else
            $('#info').append(info+'<br/>');
    }

//清除脚本与图片加载
    function delCode(d,savePic){
        var x = d;
        if(savePic!=1)
        //x = d.replace(/src=\"([^\&]+)\"/g,'xrc');
            x = d.replace(/src=/g,'xrc=');
        var s = x.indexOf('<html>');
        if(s==-1)
            s = x.indexOf('<HTML>');
        var e = x.indexOf('</html>');
        if(e==-1)
            e = x.indexOf('</HTML>');
        return x.substr(s,e);
    }

//插入请求
    function reqUrl(url){
        var xx = document.createElement('img');
        xx.height=0;
        xx.src=url+'?'+Math.random();
        $('body')[0].appendChild(xx);
    }

//作业
    function homework(){
        $.get('http://www.onlinesjtu.com/learningspace/hwk/student/main.asp?userid='+userid,function(x){
            pwd = $(x).find('iframe')[0].src.match(new RegExp("p=([^\&]+)","i"))[1].replace('p=');
            $.get('http://course.onlinesjtu.com/moodletolearningspace/assignmentforelarningspace.aspx?u='+userid+'&p=&t='+term,function(d){
                $.each($(d).find('.style1'),function(i,t){
                    if(i == 0)
                        return;
                    var tds = $(t).find('td');
                    //作业数量
                    var num = parseInt(tds.eq(2).text());
                    if(num == 0)
                        return;
                    //课程id
                    var c = tds.eq(2).find('a')[0].href.match(new RegExp("c=([^\&]+)","i"))[1].replace('c=');
                    //课程所在行
                    var az = tds.eq(2).parent();
                    $.get('http://course.onlinesjtu.com/api/uconnect.php?u='+userid+'&p='+pwd+'&c='+c+'&t='+term,function(h){
                        var z = $(h).find('.breadcrumb a').last();
                        var ccid = z.text().match(/\d+\)/)[0].replace(")","");
                        var zy = $('#zuoye_'+ccid);
                        zy.text(num).before('作业:');
                        zy.css('color','red').after('<a target="_blank" href="http://course.onlinesjtu.com/api/uconnect.php?u='+userid+'&p='+pwd+'&c='+c+'&t='+term+'">[跳转]</a>');
                    });
                });
            })
        })

    }


//提交总评
    var zptxt='';
    function zongping(cid){
        zptxt = prompt("输入总评内容",zptxt);
        $('#zongping_'+cid).text("总评：正在评价...");
        var url = 'http://218.1.73.12/PingJia/Default.aspx?sid='+userid+'&cid='+cid+'&ct=&term='+term;
        $.get(url,function(obj){
            if(!$(obj).find('#gvquestion_ctl02_rblscore_4')[0].disabled){
                var sel = $(obj).find('#ddlcourse')[0];
                var param = $(obj).eq(4).serializeArray();
                param[param.length-1].value=zptxt;
                param.push({name:"btsubmit",value:"提交评价"});
                param.push({name:"gvquestion$ctl02$rblscore",value:"5"});
                param.push({name:"gvquestion$ctl03$rblscore",value:"5"});
                param.push({name:"gvquestion$ctl04$rblscore",value:"5"});
                param.push({name:"gvquestion$ctl05$rblscore",value:"5"});
                param.push({name:"gvquestion$ctl06$rblscore",value:"5"});
                param.push({name:"rblcomment",value:"1"});
                $.post(url,param,function(d){
                    if(d.indexOf('成功')>-1){
                        $('#zongping_'+cid).html("总评：<label style='color:green'>点评成功！</label>");
                    }else{
                        $('#zongping_'+cid).html("总评：<label style='color:red'>操作失败！</label>");
                    }
                },'html')
            }
        })
    }

});


