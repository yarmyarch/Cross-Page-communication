/**
 *基于Html5 localStorage实现的跨页面通信模型。
 *该模型基本结构为：同一时间内只允许一个活动页面（MainPage），
 *其他同域页面（SubPage）需要手动激活；
 *任何一个SubPage变为MainPage的过程都会使原有的MainPage变为SubPage。
 *在该模型中，MainPage可向其他SubPage发送群组消息，
 *单个SubPage之间无逻辑关系，而只于MainPage保持连接。
 *@author yarmyarch@live.cn
 *@version 2011-9-11-0-23
 */
var MultiPageUtil = (function() {
  'use strict';
  //如果浏览器不支持，则直接返回
  if (!window.localStorage) {
    return null;
  }
  
  var self;
  
  var LC = {
    KEY : {
      RAND_ID : 'BD_LS_RI',
      PAGE_ID : 'BD_LS_PI',
      FROM : 'BD_LS_FR',
      TO : 'BD_LS_TO',
      SUB_PAGES : 'BD_LS_ALL',
      ACTIVE : 'BD_LS_ACT',
      REPLAY : 'BD_LS_RP'
    }
  };
  
  var buf = {
    randId : localStorage[LC.KEY.RAND_ID] || (localStorage[LC.KEY.RAND_ID] = LC.KEY.RAND_ID + Math.round(Math.random() * 10000000).toString(36) + '_'),
    pageController : {},
    //本地页面处理器缓存列表
    handlerList : {},
    //每个页面维护“上一次收到请求的来源”信息，通过此id与该页面建立沟通
    from : '',
    //当前页面的id。当发送一个请求时该id将被接受者记录至from字段。
    pageId : (new Date()).getTime().toString(36),
    //由init方法指定的当当前页面失去活动权限时的处理逻辑
    releaseHandler : {},
    //由init方法指定的当当前页面获得活动权限时的处理逻辑
    activeHandler : {}
  };
  
  var controller = {
    
    /**
     *活动页面处理集
     */
    mainPage : {
      
      /**
       *向所有子页面发送事件
       */
      postSubPages : function(key, value, callback) {
        
        controller.doPost(key, value, LC.KEY.SUB_PAGES, callback);
      },
      
      addPostListener : function(key, handler) {
        
        controller.addPostListener(key, handler);
      }
    },
    
    /**
     *非活动页面处理集
     */
    subPage : {
      
      /**
       *使当前页面成为活动页面
       */
      active : function(callback) {
        
        buf.pageController = controller.mainPage;
        //广播获得活动权限事件
        self.util.set(LC.KEY.ACTIVE, buf.pageId);
        buf.activeHandler && buf.activeHandler();
        callback && callback();
      },
      
      /**
       *向mainPage发送post信息
       *mainPage初始化时会广播其自身的pageid，并且mainPage的每次postSubPages也都携带了mainPage信息，
       *因此该页面中（如果不是mainPage）的from字段始终指向mainPage。
       */
      postMainPage : function(key, value, callback) {
        
        controller.doPost(key, value, buf.from, callback);
      },
      
      addPostListener : function(key, handler) {
        
        controller.addPostListener(key, handler);
      }
    },
    
    /**
     *localstorage事件分发
     */
    lsHandler : function(e) {
      
      e = e || window.event;
      //忽略clear、remove动作或者randid字段
      if (!e.key || !e.newValue) {
        return;
      }
      var key = e.key;
      
      //如果当前缓存中不存在randid，而另一个新开页面请求该字段，则更新randid
      if (key == LC.KEY.RAND_ID) {
        buf.randId = e.newValue;
        return;
      }
      
      //不处理来自自身的事件
      //事件接收后删除ls中的事件标志位信息
      var from;
      if ((from = controller.getFrom(key)) == buf.pageId) {
        return;
      }
      
      if (key.match(buf.randId)) {
        //普通属性事件
        controller.execHandler(e, key);
        return;
      } 
      //POST事件
      if (!self.controller.isMainPage()) {
        //非活动页面仅处理来自活动页面的请求
        if ((controller.getTo(key) == LC.KEY.SUB_PAGES) || (controller.getTo(key) == buf.pageId)) {
          controller.execHandler(e, key, 1);
        }
      } else {
        //活动页面，需判断to是否指向自己
        if (controller.getTo(key) == buf.pageId) {
          controller.execHandler(e, key, 1);
        }
      }
      //清空POST事件标志位
      localStorage.removeItem(key);
    },
    
    /**
     *给定ls中的key，从事件的key中读取事件来源信息并更新至from字段。
     */
    getFrom : function(key) {
      
      var from = key.split(/:/)[0];
      if (from && from.match(LC.KEY.FROM)) {
        from = from.replace(LC.KEY.FROM, '');
        return from;
      } else {
        return null;
      }
    },
    
    /**
     *给定ls中的key，从事件的key中读取事件目标。
     *如果该目标不是指向的自己，则lsHandler应该忽略该请求，
     *除非该字段指明目标为所有非活动页面(LC.KEY.SUB_PAGES)。
     */
    getTo : function(key) {
      
      //如果是一个普通请求，则没有to信息
      if (key.match(buf.randId)) {
        return null;
      }
      var to = key.split(/:/)[1];
      if (to && to.match(LC.KEY.TO)) {
        to = to.replace(LC.KEY.TO, '');
        return to;
      } else {
        return null;
      }
    },
    
    /**
     *从ls的key中读取原始的key值
     */
    getKey : function(key) {
      
      //筛选了from和to之后的key值
      return key.split(/:/)[2];
    },
    
    /**
     *给定ls中的key，获取与该key对应的处理器
     */
    getHandlerList : function(key) {
      
      var bufId = key.match(buf.randId) ? LC.KEY.RAND_ID : LC.KEY.PAGE_ID;
      return buf.handlerList[bufId + controller.getKey(key)] || [];
    },
    
    /**
     *给定ls中的key，获取事件处理器并尝试执行
     *@param e 事件对象
     *@param key{String} 存在localstorage中的key
     *@param updateFrom{Boolean} 是否更新from信息。如果需要更新，则说明这是一个post请求，同时需要回执
     */
    execHandler : function(e, key, updateFrom) {
      
      var handlerList = controller.getHandlerList(key);
      //控制器列表顺序执行
      //控制器的返回值将作为参数传入Post请求来源的callback方法参数中标准事件对象的newValue值。
      var param;
      for (var i in handlerList) {
        try {
          param = handlerList[i](e);
        } catch(error) {}
        //告知消息发送者已经接到消息，请求处理回复
        if (updateFrom && !key.match(LC.KEY.REPLAY)) {
          buf.from = controller.getFrom(key);
          //非活动页面，发送post请求时需立即更新自己的pageid
          !self.controller.isMainPage() && (buf.pageId = (new Date()).getTime().toString(36));
          localStorage[
            LC.KEY.FROM + buf.pageId +
            ':' + LC.KEY.TO + buf.from +
            ':' + LC.KEY.REPLAY + controller.getKey(key)] = param;
        }
      }
    },
    
    /**
     *使当前页面从活动页面变为非活动页面
     */
    release : function(e) {
      
      buf.pageController = controller.subPage;
      //更新from
      buf.from = e.newValue;
      //消息结束，清空消息标志位
      localStorage.removeItem(e.key);
      buf.releaseHandler && buf.releaseHandler(e);
    },
  
    /**
     *发送post的方法体
     *postMianPage月postSubPages只是to对象有差异
     *@param key {String} 用户输入的原始key
     */
    doPost : function(key, value, target, callback) {
      
      if (!target) {
        return;
      }
      //非活动页面，发送post请求时需立即更新自己的pageid
      !self.controller.isMainPage() && (buf.pageId = (new Date()).getTime().toString(36));
      var tmpKey = LC.KEY.FROM + buf.pageId + ':' + LC.KEY.TO + target + ':';
      //添加临时监听器，监听该请求的回复信息
      self.controller.addPostListener(LC.KEY.REPLAY + key, function(e) {
        
        //回调中删除该请求的回复信息缓存
        //~ localStorage.removeItem(tmpKey);
        //删除缓存的listener
        delete buf.handlerList[LC.KEY.PAGE_ID + controller.getKey(e.key)];
        try {
          callback && callback(e);
        } catch(error) {}
      });
      //发送post
      localStorage[tmpKey + key] = value;
    },
    
    addPostListener : function(key, handler) {
      
      key = LC.KEY.PAGE_ID + key;
      !buf.handlerList[key] && (buf.handlerList[key] = []);
      buf.handlerList[key].push(handler);
    }
  };
  
  return self = {
    
    /**
     *初始化方法。在执行初始化方法之前，页面控制相关的方法将不会有任何动作。
     *每个页面在初始化时都会尝试成为活动页面。
     *@param [onActive{Function}] 初始化并成功获得活动权限之后的回调函数
     *@param [onRelease{Function}] 当前页面失去活动权限之后的处理逻辑
     */
    init : function(onActive, onRelease) {
      
      //监听LocalStorage      
      if (window.addEventListener) {
        window.addEventListener('storage', controller.lsHandler);
        document.addEventListener('storage', controller.lsHandler);
      }
      //保险起见
      if (document.attachEvent) {
        document.attachEvent('onstorage', controller.lsHandler);
        window.attachEvent('onstorage', controller.lsHandler);
      }
      
      //注册当前页面为活动页面
      buf.pageController = controller.subPage;
      buf.activeHandler = onActive;
      self.controller.active();
      
      //监听来自其他页面的活动页面请求，当当前页面为活动页面时处理该请求
      buf.releaseHandler = onRelease;
      self.util.addListener(LC.KEY.ACTIVE, controller.release);
    },
    
    util : {
      
      /**
       *基本容器方法
       *向localstorage中添加普通字段
       */
      add : function(key, value) {
        
        localStorage[buf.randId + ':' + buf.randId + ':' + key] = value;
      },
      
      /**
       *基本容器方法
       *更新localstorage中的某字段值
       *如果之前未添加，则新增该字段
       */
      set : function(key, value) {
        
        localStorage[buf.randId + ':' + buf.randId + ':' + key] = value;
      },
      
      /**
       *基本容器方法
       *获取某个字段
       */
      get : function(key) {
        
        return localStorage[buf.randId + ':' + buf.randId + ':' + key];
      },
      
      /**
       *基本容器方法
       *获取某个字段，并在获取之后删除缓存内容
       */
      getAndClear : function(key) {
        
        key = buf.randId + ':' + buf.randId + ':' + key;
        var result = localStorage[key];
        localStorage.removeItem(key);
        return result;
      },
      
      /**
       *基本容器方法
       *删除某个字段
       */
      remove : function(key) {
        
        localStorage.removeItem(buf.randId + key);
      },
      
      /**
       *对一个来自localStorage中的某个属性变化事件添加处理器
       *支持添加多个处理器
       *该方法不区分来源。
       *@param key {String} 需要监听的属性key
       *@param handler {Function(e)} 被监听的key的value发生变化（由基本容器方法触发）时的处理函数，e为storage标准事件对象
       */
      addListener : function(key, handler) {
        
        key = LC.KEY.RAND_ID + key;
        !buf.handlerList[key] && (buf.handlerList[key] = []);
        buf.handlerList[key].push(handler);
      }
    },
    
    controller : {
      
      /**
       *判断当前页面是否为活动页面。
       */
      isMainPage : function() {
        return buf.pageController == controller.mainPage;
      },
      
      /**
       *页面控制类方法
       *使当前页面变为活动页面。
       *如果当前页面已经是一个活动页面，则什么也不做
       */
      active : function(callback) {
        return buf.pageController.active && buf.pageController.active(callback);
      },
      
      /**
       *页面控制类方法
       *如果当前页面是一个SubPage，则该方法将向活动页面发送一个请求。
       *@param key {String} 请求标志位，类似Ajax请求中的URL
       *@param value {String} 请求数据，可用于传递请求参数并在对应的事件处理器中通过e.newValue获取
       *@param [callback] {Function} 请求响应函数。该函数将接收来自MainPage关于该请求的回复字符串
       */
      postMainPage : function(key, value, callback) {
        return buf.pageController.postMainPage && buf.pageController.postMainPage(key, value, callback);
      },
      
      /**
       *页面控制类方法
       *如果当前页面是一个MainPage，则该方法将向活动页面发送一个请求。
       *@param key {String} 请求标志位，类似Ajax请求中的URL
       *@param value {String} 请求数据，可用于传递请求参数并在对应的事件处理器中通过e.newValue获取
       *@param [callback] {Function} 请求响应函数。该函数将接收来自SubPage关于该请求的回复字符串
       *注意，如果当前存在多个非活动页面，callback将可能被执行多次。
       */
      postSubPages : function(key, value, callback) {
        return buf.pageController.postSubPages && buf.pageController.postSubPages(key, value, callback);
      },
      
      /**
       *页面控制类方法
       *对一个来自其他页面的Post事件添加处理器。
       *该方法区分来源，即MainPage能监听来自所有SubPage的事件，
       *SubPage仅能监听来自MainPage的事件。
       *@param key {String} 需要监听的属性key
       *@param handler {Function(e)} 被监听的key的value发生变化时的处理函数。传入参数为onstorage标准事件对象
       *handler的返回值将作为post请求中callback方法参数中标注事件e的newValue。
       *如果为一个字段指定了多个listener，则该post的请求会收到多次响应。
       */
      addPostListener : function(key, handler) {
        return buf.pageController.addPostListener && buf.pageController.addPostListener(key, handler);
      }
    }
  };
})();
