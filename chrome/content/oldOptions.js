/**
 * ScrollbarSearchHighlighter namespace.
 */
if ("undefined" == typeof(ScrollbarSearchHighlighter)) {
  var ScrollbarSearchHighlighter = {};
};

/**
 * Controls the options XUL for the Scrollbar Search Highlighter extension.
 *
 * Note that only the color preference handling needs this javascript.
 * Basically it only handles:
 * a) which radio to select based on the preference (during load)
 * b) updating the custom radio's "value" attribute when the color picker changes
 * c) deciding on a foreground color for the chosen color
 * d) disabling the color picker if the custom radio is not selected
 */
ScrollbarSearchHighlighter.Options = {
    branch : "extensions.scrollbarSearchHighlighter",
    prefName : ".highlightColor",

    // dumps a message to the javascript console
    messageToConsole: function(aMessage) {
      var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                     .getService(Components.interfaces.nsIConsoleService);
      consoleService.logStringMessage("ScrollbarSearchHighlighter.Options: " + aMessage);
    },
  
    onCancel : function() {
      //////ScrollbarSearchHighlighter.Options.messageToConsole("onCancel() called");
      // TODO could prompt to save changes?
      return true;
    },
    
    onAccept : function() {
      try {
        /////////////ScrollbarSearchHighlighter.Options.messageToConsole("onAccept() called");
        // Get the "extensions.scrollbarSearchHighlighter" branch
        var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(Components.interfaces.nsIPrefService).getBranch(ScrollbarSearchHighlighter.Options.branch);
        
        var radio = document.getElementById("color_radio_group").selectedItem;
        ScrollbarSearchHighlighter.Options.messageToConsole("found selected: " + radio);
        
        if ( radio != null )
        {
          var color;
          ScrollbarSearchHighlighter.Options.messageToConsole("selected radio's value = (" + radio.value + ")");
          color = "#" + radio.value.replace('#','');

          prefs.setCharPref(ScrollbarSearchHighlighter.Options.prefName, color);

          // Set page highlight color to match the bar highlight color
          var uiPrefs = Components.classes["@mozilla.org/preferences-service;1"]
               .getService(Components.interfaces.nsIPrefService)
               .getBranch("ui");

          uiPrefs.setCharPref(".textHighlightBackground", color);

          // Note: FF (4-12) doesn't seem to respect setting the foreground
          // highlight color, so I removed that code.
        }

        // Doesn't appear that we need to call prefpane.writePreferences()...
        
        //ScrollbarSearchHighlighter.Options.messageToConsole("onAccept() returning true");
        return true;
      }
      catch (err) {
        ScrollbarSearchHighlighter.Options.messageToConsole("onAccept() caused exception: " + err);
        return false;
      }
    },
    
    onLoad : function() {
      //////ScrollbarSearchHighlighter.Options.messageToConsole("onLoad() called");

      // Get the "extensions.scrollbarSearchHighlighter" branch
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefService)
                   .getBranch(ScrollbarSearchHighlighter.Options.branch);

      // prefs is an nsIPrefBranch.

      var value = prefs.getCharPref(ScrollbarSearchHighlighter.Options.prefName).replace('#','');
      var radio = document.getElementById('c_' + value + '_radio');
      var group = document.getElementById('color_radio_group');
      var customRadio = document.getElementById('c_custom_radio');
      var picker = document.getElementById('color_picker');
      
      if ( radio ) {
        ScrollbarSearchHighlighter.Options.messageToConsole("found checkbox for color");
        group.selectedItem = radio;
      }
      else {
        ScrollbarSearchHighlighter.Options.messageToConsole("didn't find checkbox for color");
        group.selectedItem = customRadio;
      }

      picker.color = '#' + value;
      customRadio.value = picker.color;
      picker.onchange = ScrollbarSearchHighlighter.Options.onColorPickerChange;

      //////ScrollbarSearchHighlighter.Options.messageToConsole("onLoad() returning");
    },

    onColorPickerChange : function() {
      var radio = document.getElementById('c_custom_radio');
      radio.value = document.getElementById('color_picker').color;
      ScrollbarSearchHighlighter.Options.messageToConsole("set custom radio's value to (" + radio.value + ")");
      // and in case it wasn't already selected:
      document.getElementById("color_radio_group").selectedItem = radio;
    }
};
