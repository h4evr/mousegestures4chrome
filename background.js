/*global chrome*/
function back(tab) {
  chrome.tabs.executeScript(tab.id, {
    code: 'history.back();'
  });
}

function forward(tab) {
  chrome.tabs.executeScript(tab.id, {
    code: 'history.forward();'
  });
}

function newTab() {
  chrome.tabs.create({});
}

function closeTab(tab) {
  chrome.tabs.remove(tab.id);
}

function togglePin(tab) {
  chrome.tabs.update(tab.id, {
    pinned: !tab.pinned
  });
}

var actions = {
  "back": back,
  "forward": forward,
  "newtab": newTab,
  "closetab": closeTab,
  "togglepin": togglePin
};

function executeAction(action, tab) {
  if (actions.hasOwnProperty(action)) {
    return actions[action](tab);
  }
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action) {
    executeAction(message.action, sender.tab);
  } else if (message.getConfigs) {
    sendResponse(JSON.parse(localStorage.mousegesturesconfig));
  }
});

chrome.webNavigation.onCommitted.addListener(function (details) {
  chrome.tabs.executeScript(details.tabId, {
    "file": "mousegestures.js"
  });
});

chrome.runtime.onInstalled.addListener(function () {
  if (!localStorage.mousegesturesconfig) {
    localStorage.mousegesturesconfig = JSON.stringify({
      "showTrail": true,
      "doubleClickInterval": 600,
      "rockerInterval": 600,
      "mappings": {
        "rockerleft": "back",
        "rockerright": "forward",
        "L": "back",
        "R": "forward",
        "U": "newtab",
        "D": "togglepin",
        "DR": "closetab"
      }
    });
    console.log("Resetted configurations.");
  }
});