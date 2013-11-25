Cross-Page-communication
========================

Cross Page communication with javascript based on LocalStorage. Pages should under the same domain name and browser.

It's designed with the under a main-sub page model. There is only 1 main page actived at a time, while all other pages at the same domain with this file loaded are treated as "subpages". The main page always send notifications/messages to all subpages, while each sub page always send messages to the mainpage only.

A subpage can always register itself as a mainpage by calling a function, that turns all other pages into subpages.

### Supported browsers:
    
All formal browsers that approves LocalStorage. However, there might be some problems in elder version of IE such as IE9, which can't dispatch the onstorage event correctly.

### Usage:
```java
/**
 * Active current page and try to register itself as the mainpage.
 * @param onActive {Function} 
 *    callback while initialization finished.
 * @param onRelease {Function} 
 *    callback while set as a subpage by other mainpage requests.
 */
MultiPageUtil.init(onActive, onRelease);

/**
 * Grouped function list that's designed to replace the original 
 *    LocalStorage.add/set/remove/clear under specialized rules to prevent name-space issues.
 */
MultiPageUtil.util.add;
MultiPageUtil.util.set;
MultiPageUtil.util.get;
MultiPageUtil.util.getAndClear;
MultiPageUtil.util.addListener;

/**
 * Test if the current page a main page.
 */
MultiPageUtil.controller.isMainPage();

/**
 * Register itself as a mainPage.
 */
MultiPageUtil.controller.active(callback);

/**
 * As a subpage, send request to the main page. All requests are based on string. 
 * If you would like other data structure, build it yourself with string.
 * @param key {String} 
 *    request identifier
 * @param requestValue {String} 
 *    request body, or params that are supposed by request handlers.
 * @param callback {Function(responseText)} 
 *    The mainpage would tell the current subpage if it received the request with a response in String.
 */
MultiPageUtil.controller.postMainPage(key, requestText, callback);

/**
 * As a mainPage, send requests to all subpages.
 * If you would like other data structure, build it yourself with string.
 * @param key {String} 
 *    request identifier
 * @param requestValue {String} 
 *    request body, or params that are supposed by request handlers.
 * @param callback {Function(responseText)} 
 *    All subpages would report it's response status. It could be executed multi-times, 
 *    based on the number of actived subpages.
 */
MultiPageUtil.controller.postSubPages(key, requestText, callback);

/**
 * Add a handler for the specific identifier.
 * The handler would only be actived in case of:
 *    1. As a mainpage, received a request from other subpages;
 *    2. As a subpage, received a request from the actived mainpage.
 * @param key {String} 
 *    request identifier
 * @param handler {Function(requestText)} 
 *    handler for the specific request identifier.
 */
MultiPageUtil.controller.addPostListener(key, handler);
```