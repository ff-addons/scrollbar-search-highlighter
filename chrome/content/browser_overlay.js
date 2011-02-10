/**
 * ScrollbarSearchHighlighter namespace.
 */
if ("undefined" == typeof(ScrollbarSearchHighlighter)) {
  var ScrollbarSearchHighlighter = {};
};

/**
 * Controls the browser overlay for the Scrollbar Search Highlighter extension.
 */
ScrollbarSearchHighlighter.BrowserOverlay = {

  // number of rows in the highlight grid - kind of the "highlight granularity"
  NUM_ROWS : 200,
  
  // the highlight color; matches the pink used for "highlight all" except for "current" match
  HIGHLIGHT_COLOR : "#ef0fff",
  
  // the delay before re-highlighting after user types into the find field
  // TODO is 500ms always enough time? it seems like it's not ready before that in my testing...
  REHIGHLIGHT_DELAY : 500,

  // The timer variable   
  highlightTimer : null,
  
  // dumps a message to the javascript console
  messageToConsole: function(aMessage) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                   .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("ScrollbarSearchHighlighter: " + aMessage);
  },
  
  // Returns a string containing a dump of all (most) of the given object's properties.
  dumpProperties : function(obj,name,indent) {
    var str;
    
    str = indent + name + " (" + typeof(obj) + "):\n";

    for (var thingie in obj) {
      if ( null == thingie.match(/[a-z]/) ) {
        // probably some constant
        continue; // TODO make that optional
      }
      try {
        var prop = obj[thingie];
        if ( prop && typeof(prop) != 'function' ) { // TODO && typeof(prop) != 'object' ) {
          if ( typeof(prop) == 'string' && prop.length > 50 ) {
            str = str + indent + "  " + thingie + ": " + prop.substring(0,50) + "... (" + typeof(prop) + ")\n";
          }
          else {
            str = str + indent + "  " + thingie + ": " + prop + " (" + typeof(prop) + ")\n";
          }
        }
      }
      catch (err) {
        // Some error?
          str = str + indent + "  " + thingie + ": ERROR\n";
      }
    }
    return str;
  },
  
  clearHighlight : function() {
    var grid = document.getElementById("highlight-grid");
    var rows = grid.getElementsByTagName("rows")[0];
    for (var i = 1 ; i < rows.childNodes.length-1 ; i++)
    {
      var row_i = rows.childNodes[i];

      row_i.style.backgroundColor = null;// for debugging: "#0000ff"
    }
  },
 
  // Adds the extra grid rows to the scrollbar, as needed
  addGridRows : function() {
    // set up the grid
    var grid = document.getElementById("highlight-grid");
    var rows = grid.getElementsByTagName("rows")[0];

    if ( rows.childNodes.length < 5 ) {
      // we need to append the rows
      var row0 = document.getElementById("first-grid-row");
        
      for (var i = 1 ; i < ScrollbarSearchHighlighter.BrowserOverlay.NUM_ROWS ; i++)
      {
        var row_i = row0.cloneNode(true);
        row_i.id = null;

        rows.appendChild(row_i);
      }

      // append another spacer at the bottom...
      var end_sbar = document.getElementById("sbar-arrow-top-spacer").cloneNode(true);
      end_sbar.id = "sbar-arrow-bottom-spacer";
      rows.appendChild(end_sbar);
    }
      
    // We already added the grid rows.
    // Now we fix up the spacer at the bottom.  It could be done just once, but doing it
    // each time helps make sure it accommodates the following situations:
    // - when a horizontal scrollbar is visible
    // - when certain addons that shrink the browser area (such as FireBug) are visible
      
    var html = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0];
    var body = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("body")[0];
    var top_spacer = document.getElementById("sbar-arrow-top-spacer");
    var bot_spacer = document.getElementById("sbar-arrow-bottom-spacer");
        
    var gridPad = (
      grid.clientHeight - html.clientHeight  // to accommodate browser-shrinking addons like firebug
      + top_spacer.clientHeight              // the bottom scrollbar arrow button
      - 1                                    // some mystical padding to make the bottom line up - doesn't always work
    );
    bot_spacer.height = gridPad;
  },
 
  // Sets up a timer to re-highlight after a short delay
  rehighlightLater : function(e) {
    if ( ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer != null ) {
      clearTimeout(ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer);
    }
    
    ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer
      = setTimeout(ScrollbarSearchHighlighter.BrowserOverlay.rehighlight,ScrollbarSearchHighlighter.BrowserOverlay.REHIGHLIGHT_DELAY);

    // Now check the "Highlight all" button if the preference is set to do so.
    
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefService).getBranch("extensions.scrollbarSearchHighlighter");
    if ( prefs.getBoolPref(".highlightByDefault") ) {
      var highlight_button = gFindBar.getElement("highlight");
      highlight_button.checked = true;
    }
  },
  
  // Re-highlights if the "Highlight All" button is selected.
  rehighlight : function(e) {
    try {
      ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer = null;

      ScrollbarSearchHighlighter.BrowserOverlay.clearHighlight();
    
      var highlight_button = gFindBar.getElement("highlight");
      var grid = document.getElementById("highlight-grid");

      // Note that we're shrinking the grid if highlight-all is not enabled, and growing it if it is enabled.

      if ( highlight_button.checkState == 0 ) {
        //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("hello - not highlighting; checkState = 0");
        grid.minWidth = "0%";
        return;
      }

      // If we get here, we'll probably be highlighting
      
      grid.minWidth = "5%"; 
      
      ScrollbarSearchHighlighter.BrowserOverlay.addGridRows();

      var rows = grid.getElementsByTagName("rows")[0];
      
      //////////////////////////////
      var _findSelection = gFindBar.nsISelectionController.SELECTION_FIND;
      var win = gFindBar.browser.contentWindow; // TODO findbar.xml does win.frames too...
      var controller = gFindBar._getSelectionController(win);
      var sel = controller.getSelection(_findSelection);

      ////var at = "found " + sel.rangeCount + " ranges\n";

      if ( gBrowser.selectedBrowser ) {
        var fullHtmlHeight = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollHeight;
        var scrollTop = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollTop;
        ////at = at + "  HTML.scrollHeight = " + fullHtmlHeight + "\n";

        for (var i = 0 ; i < sel.rangeCount ; i++)
        {
          var r = sel.getRangeAt(i);
          var rect = r.getBoundingClientRect();

          var absTop = (rect.top + scrollTop) / fullHtmlHeight;
          var absBot = (rect.bottom + scrollTop) / fullHtmlHeight;

          //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole(" match.top = " + rect.top + " (absolute: " + absTop + " == " + absTop/fullHtmlHeight + ")");

          for (var j = 1 ; j < rows.childNodes.length-1 ; j++)
          {
            var row_j = rows.childNodes[j];
 
            var row_top = (j-1) / (rows.childNodes.length-2);
            var row_bottom = (j) / (rows.childNodes.length-2);
            
            // If any part of the row's range is within the match's range, highlight it
            if (
                 ( absTop >= row_top    || absBot >= row_top    )
                 &&
                 ( absTop <= row_bottom || absBot <= row_bottom )
               )
            {
              row_j.style.backgroundColor = ScrollbarSearchHighlighter.BrowserOverlay.HIGHLIGHT_COLOR;
            }
          }
        }
        ////at = at + ScrollbarSearchHighlighter.BrowserOverlay.dumpProperties(gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0],"HTML","  ");
      }
      ////alert(at);

      //////////////////////////////
    }
    catch (err) {
      Components.utils.reportError(err);
    }
  },
  
  // Called when a new tab is selected.
  tabSelected : function(e) {
    // In my 4.0b7, the "highlight all" is always un-selected when this
    // happens.  But rather than depend on that, I'm just going to call rehighlightLater...
    ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater();
  },
  
  // Initializes for a new window...
  initialize : function() {
    try {
      // register with the findbar
      gFindBar.getElement("findbar-textbox").addEventListener("keyup",ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater,false);
      gFindBar.getElement("highlight").addEventListener("command",ScrollbarSearchHighlighter.BrowserOverlay.rehighlight,false); // tried "click" it didn't work

      // We register for tab switches because the "Highlight all" button is unclicked on those, so we need to clear the highlight.
      gBrowser.tabContainer.addEventListener("TabSelect",ScrollbarSearchHighlighter.BrowserOverlay.tabSelected, false);

      // Now open the options page if the extension hasn't been run yet
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefService).getBranch("extensions.scrollbarSearchHighlighter");
      if ( prefs.getBoolPref(".firstRun") ) {
        window.setTimeout(function(){  
                gBrowser.selectedTab = gBrowser.addTab("chrome://scrollbar_search_highlighter/content/options.html");
          }, 1500); //<b style="color:black;background-color:#ffff66">Firefox</b> 2 fix - or else tab will get closed  
        prefs.setBoolPref(".firstRun",false);
      }

    }
    catch (err) {
      Components.utils.reportError(err);
    }
    
  }
};

window.addEventListener(  
  "load", function() { setTimeout(ScrollbarSearchHighlighter.BrowserOverlay.initialize,500); }, false);  
  
