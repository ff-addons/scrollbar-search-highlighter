/**
 * ScrollbarSearchHighlighter namespace.
 */
if ("undefined" == typeof(ScrollbarSearchHighlighter)) {
  var ScrollbarSearchHighlighter = {};
};

/**
 * Controls the browser overlay for the Scrollbar Search Highlighter extension.
 * == My TODOs outstanding ==
 *
 * == USER TODOs oustanding ==
 * USER TODO If the highlight all could be enabled with 3 or more characters, it would be perfect.
 *
 * == BUG REPORTS outstanding ==
 * BUG REPORT BlackFox has it moved over a bit
 * BUG REPORT there is a userscript for 4chan.org that expands useruploaded images to it's full size 
 *            (http://userscripts.org/scripts/show/48538).  when this happens, the pink marker on the
 *            side doesn't point to the correct spot since everything on the page has shifted down.
 *
 * == USER TODOs done ==
 * USER TODO if the vertical bar disappears with the searchbar, there should be an option that the highlighted text does so, too.
 * USER TODO any chance we could have the option to set the highlight color in hex? (color picker would be amazing...lol)
 * USER TODO the "highlights" in the vertical bar should be clickable and then lead to the corresponding highlighted part of text.
 * USER TODO what about a floating match count or one added to the find bar?
 *           browser-bottombox has "FindToolbar" id that is a findbar
 *           FindToolbar has a hbox child with class of "findbar-container" with all the children
 *           last thing in there is the "findbar-find-fast" components which are hidden...
 * USER TODO the vertical bar should be a little more customizable (I'd like it a little wider)
 *
 * == USER TODOs most likely not possible ==
 * USER TODO any chance you can give the page highlights a border radius style so they aren't so blocky/square?
 */
ScrollbarSearchHighlighter.BrowserOverlay = {

  // number of rows in the highlight grid - kind of the "highlight granularity"
  NUM_ROWS : 200,
  
  // the delay before re-highlighting after user types into the find field
  // TODO is 500ms always enough time? it seems like it's not ready before that in my testing...
  REHIGHLIGHT_DELAY : 500,

  // The timer variable   
  highlightTimer : null,
  
  countLabel : null,
  
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
  
  // return a boolean preference from this extension's preferences branch
  // "name" should include the dot (e.g. ".highlightByDefault")
  getBoolPref : function(name) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefService).getBranch("extensions.scrollbarSearchHighlighter");
    return prefs.getBoolPref(name);
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
        
    if ( !html )
      return;
    
    var gridPad = (
      grid.clientHeight - html.clientHeight  // to accommodate browser-shrinking addons like firebug
      + top_spacer.clientHeight              // the bottom scrollbar arrow button
      - 1                                    // some mystical padding to make the bottom line up - doesn't always work
    );
    bot_spacer.height = gridPad;
  },
 
  // Scrolls to where the user clicked in the grid
  gridClicked : function(e) {
    ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("grid clicked");
    var grid = document.getElementById("highlight-grid");

    if ( gBrowser.selectedBrowser ) {
      var fullHtmlHeight = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollHeight;
      var clientHeight = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].clientHeight;
      
      // make it so the match was approximately in the middle of the scrollbar
      // Note: using the rangeOffset appears to work, but I'm not sure why...
      var scrollTop = e.rangeOffset / ScrollbarSearchHighlighter.BrowserOverlay.NUM_ROWS * fullHtmlHeight - clientHeight/2;
      
      gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollTop = scrollTop;
    }
    
  },

  populateCountLabel: function(val) {
      //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("populating count label with (" + val + ")");
      // pad the string - this makes it the right size on my windows 7 pc.
      var valString = "" + val;
      var extra = 4 - valString.length;
      for (var i = 0 ; i < extra ; i++){
        valString = valString + "  ";
      }
      ScrollbarSearchHighlighter.BrowserOverlay.countLabel.value = valString;
      ScrollbarSearchHighlighter.BrowserOverlay.countLabel.setAttribute("value",valString);
  },
  
  // Sets up a timer to re-highlight after a short delay
  rehighlightLater : function(e) {
    ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("re-highlighting later");
    
    if ( ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer != null ) {
      clearTimeout(ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer);
    }
    
    ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer
      = setTimeout(ScrollbarSearchHighlighter.BrowserOverlay.rehighlight,ScrollbarSearchHighlighter.BrowserOverlay.REHIGHLIGHT_DELAY);

    // Now check the "Highlight all" button if the preference is set to do so.
    
    if ( ScrollbarSearchHighlighter.BrowserOverlay.getBoolPref(".highlightByDefault") ) {
      var highlight_button = gFindBar.getElement("highlight");
      highlight_button.checked = true;
    }

//    ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole(
//        ScrollbarSearchHighlighter.BrowserOverlay.dumpProperties(gFindBar.getElement("highlight"),"highlight_button","")
//    );
  },
  
  // Re-highlights if the "Highlight All" button is selected.
  rehighlight : function(e) {
    try {
      ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer = null;

      ScrollbarSearchHighlighter.BrowserOverlay.clearHighlight();
    
      var highlight_button = gFindBar.getElement("highlight");
      var grid = document.getElementById("highlight-grid");

      // Note that we're hiding (shrinking) the grid if:
      //  the findbar is hidden, OR
      //  the "highlight-all" button is disabled, OR
      //  the "highlight-all" button is unchecked
      //
      // And showing (growing) the grid if any of those is false

      if (    gFindBar.hidden == true
           || highlight_button.disabled == true 
           || highlight_button.checkState == 0 )
      {
        //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("not highlighting; checkState = " + highlight_button.checkState + " and gFindBar.hidden=" + gFindBar.hidden);
        grid.minWidth = "0%";
        grid.maxWidth = "0%";
        return;
      }

      // If we get here, we'll probably be highlighting
      
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefService)
                   .getBranch("extensions.scrollbarSearchHighlighter");
      var width = prefs.getIntPref(".width");

      grid.minWidth = "" + width + "%"; 
      grid.maxWidth = "" + width + "%"; 
      
      ScrollbarSearchHighlighter.BrowserOverlay.addGridRows();

      var rows = grid.getElementsByTagName("rows")[0];
      
      //////////////////////////////
      var _findSelection = gFindBar.nsISelectionController.SELECTION_FIND;
      var win = gFindBar.browser.contentWindow; // TODO findbar.xml does win.frames too...
      var controller = gFindBar._getSelectionController(win);
      var sel = controller.getSelection(_findSelection);

      // TODO why doesn't finding "course" in "My Learning" work?
      // TODO why doesn't finding in a heavily framed page work?
      // TODO look in findbar.xml for _highlightDoc to look for sub-window code
      
      //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("found " + sel.rangeCount + " ranges");

      ScrollbarSearchHighlighter.BrowserOverlay.populateCountLabel(0);


      if ( gBrowser.selectedBrowser ) {
      
        var highlightColor = prefs.getCharPref(".highlightColor");
        ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("highlight color = (" + highlightColor + ")");

        var fullHtmlHeight = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollHeight;
        var scrollTop = gBrowser.selectedBrowser.contentDocument.getElementsByTagName("html")[0].scrollTop;

        ScrollbarSearchHighlighter.BrowserOverlay.populateCountLabel(sel.rangeCount);

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
              row_j.style.backgroundColor = highlightColor;
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
    ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater();
  },
  
  finalize : function() {
    ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("finalize called");

    // now unregister for all listeners
      
    gFindBar.getElement("findbar-textbox").removeEventListener("keyup",ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater,false);
    gFindBar.getElement("highlight").addEventListener("command",ScrollbarSearchHighlighter.BrowserOverlay.rehighlight,false);
    gFindBar.removeEventListener("DOMAttrModified", ScrollbarSearchHighlighter.BrowserOverlay.findbarAttributeChanged, false);
    gBrowser.tabContainer.addEventListener("TabSelect",ScrollbarSearchHighlighter.BrowserOverlay.tabSelected, false);
      
    document.getElementById("highlight-grid").removeEventListener("click",ScrollbarSearchHighlighter.BrowserOverlay.gridClicked,false);

    // and clear the timeout just for completeness
    if ( ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer != null ) {
        clearTimeout(ScrollbarSearchHighlighter.BrowserOverlay.highlightTimer);
    }
  },
  
  // Event handler for attribute changes on the "gFindBar" object.
  // When the findbar is hidden, we also hide the matches
  findbarAttributeChanged : function(event) {
    if ( event.attrName != "hidden" ) {
      return;
    }

    if ( false == ScrollbarSearchHighlighter.BrowserOverlay.getBoolPref(".hideWhenFinderHidden") ) {
      return;
    }
    
    // we're just trying to catch onto when the findbar has been hidden
    // if MODIFICATION: bar was hidden iff new value is "true" (4.0b11 is a string "true" not a boolean)
    // if ADDITION:     bar was hidden iff new value is "true" (4.0b11 is a string "true" not a boolean)
    // if REMOVAL:      bar was not hidden
    
    if ( event.attrChange == event.MODIFICATION && (event.newValue == true || event.newValue == "true") ) {
      // Bar was hidden.
    }
    else if ( event.attrChange == event.ADDITION && (event.newValue == true || event.newValue == "true") ) {
      // Bar was hidden.
    }
    else {
      // Any other case, the bar was not hidden
      return;
    }

    // clear the highlights

    // TODO findbar.xml does win.frames too...
    if ( gBrowser.selectedBrowser ) {
      var _findSelection = gFindBar.nsISelectionController.SELECTION_FIND;
      var win = gFindBar.browser.contentWindow;
      var sel = gFindBar._getSelectionController(win).getSelection(_findSelection);
      sel.removeAllRanges();

      //ScrollbarSearchHighlighter.BrowserOverlay.messageToConsole("DONE - now has " + sel.rangeCount + " ranges");
    }
    
    ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater();
  },
  
  // Initializes for a new window...
  initialize : function() {
    try {
      // register with the findbar
      gFindBar.getElement("findbar-textbox").addEventListener("keyup",ScrollbarSearchHighlighter.BrowserOverlay.rehighlightLater,false);
      gFindBar.getElement("highlight").addEventListener("command",ScrollbarSearchHighlighter.BrowserOverlay.rehighlight,false); // tried "click" it didn't work

      gFindBar.addEventListener("DOMAttrModified", ScrollbarSearchHighlighter.BrowserOverlay.findbarAttributeChanged, false);

      // We register for tab switches because the "Highlight all" button is unclicked on those, 
      // and we have a property that might make that button auto-checked when we switch tabs.
      gBrowser.tabContainer.addEventListener("TabSelect",ScrollbarSearchHighlighter.BrowserOverlay.tabSelected, false);

      // register for grid clicks
      document.getElementById("highlight-grid").addEventListener("click",ScrollbarSearchHighlighter.BrowserOverlay.gridClicked,false);

      // Now open the options page if the extension hasn't been run yet
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefService).getBranch("extensions.scrollbarSearchHighlighter");
      if ( prefs.getBoolPref(".firstRun") ) {
        window.setTimeout(function(){  
                gBrowser.selectedTab = gBrowser.addTab("chrome://scrollbar_search_highlighter/content/options.html");
          }, 1500);
        prefs.setBoolPref(".firstRun",false);
      }

      window.addEventListener(  
         "unload", ScrollbarSearchHighlighter.BrowserOverlay.finalize, false);
         
      // Now add an overlay to the findbar with the match count.
      // This cannot be done with XUL overlay because the findbar children do not have "id" attributes.
      // Note setting the "margin" is needed because the labels don't line up with other labels without
      // it (actually in a DOM inspector window they looked fine).

      var elementForBefore = document.getAnonymousElementByAttribute(gFindBar,"anonid","match-case-status");

      var findbarContainer = gFindBar.getElement("findbar-container");

      var labelLabel = document.createElement("label");
      labelLabel.setAttribute("value","Count:");
      
      var countLabel = document.createElement("label");

      labelLabel.style.margin = "5px";
      countLabel.style.margin = "5px";

      findbarContainer.insertBefore(labelLabel, elementForBefore);
      findbarContainer.insertBefore(countLabel, elementForBefore);

      ScrollbarSearchHighlighter.BrowserOverlay.countLabel = countLabel;

      ScrollbarSearchHighlighter.BrowserOverlay.populateCountLabel(0);
    }
    catch (err) {
      Components.utils.reportError(err);
    }
  },
  
  initializeLater : function() {
      setTimeout(ScrollbarSearchHighlighter.BrowserOverlay.initialize,500);
  }
};

window.addEventListener( "load", ScrollbarSearchHighlighter.BrowserOverlay.initializeLater, false);
