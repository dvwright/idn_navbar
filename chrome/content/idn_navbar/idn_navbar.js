//dump('Loading idn_navbar');

//http://blogger.ziesemer.com/2007/10/respecting-javascript-global-namespace.html
if(!us) var us={};
if(!us.dwright) us.dwright={};
if(!us.dwright.IDN_Navbar) us.dwright.IDN_Navbar={};

us.dwright.IDN_Navbar = {

  initial_n    : 0x80,
  initial_bias : 72,
  delimiter    : "\x2D",
  base         : 36,
  damp         : 700,
  tmin         : 1,
  tmax         : 26,
  skew         : 38,
  maxint       : 0x7FFFFFFF,

  onLoad: function() {
    var gURLBar = document.getElementById("urlbar");
    if(gURLBar){
      // change nav bar to display IDN as soon as possible,
      // this event happens before DOMContentLoaded
      gURLBar.addEventListener("ValueChange", this.onValueChange_urlbar, true);
    }
  },
  unLoad: function() {
    if(gURLBar){
      gURLBar.removeEventListener("ValueChange", this.onValueChange_urlbar, true);
    }
  },
  // Top Level Domain Regex - sufficient?
  // TODO add this to the parseuri js lib below
  tld: function(uri){
    if (!uri) return false;

    var tld_re = new RegExp("\.([a-z,A-Z]{2,6})$");
    var m = uri.match(tld_re);

    if (m && m[1]) return m[1];

    return false;
  },
  onValueChange_urlbar: function(aEvent) {
    var uri = gURLBar.value;
    //dump("VC_URI: " + uri + "\n");
    if (!uri) return; // skip if no uri (shouldn't actually happen)

    if (uri.indexOf('xn--') < 0){
      // remove IDN icon - not an IDN
      var idn_ico = document.getElementById('idn_icon');
      if (idn_ico) gURLBar.removeChild(idn_ico);
      return;  // skip unless is PUNYCODE
    }

    // OK, we have an IDN, remove IDN icon if exists,
    // since we append, the icon's would accumlate, bad!
    var idn_ico = document.getElementById('idn_icon');
    if (idn_ico) gURLBar.removeChild(idn_ico);

    var tld = us.dwright.IDN_Navbar.tld(us.dwright.IDN_Navbar.ParseURI.parseUri(uri).host);
    // our regex could be faulty
    if (!tld) return('Cannot determine TLD');

    var protocol = us.dwright.IDN_Navbar.ParseURI.parseUri(uri).protocol;
    var relative = us.dwright.IDN_Navbar.ParseURI.parseUri(uri).relative;

    // decoder needs domain name only, remove the 'xn--' and TLD
    // this replace only works because we pass hostname only (no '/' or '?args')
    //dump("VC_ParseURI: " + us.dwright.IDN_Navbar.ParseURI.parseUri(uri).host + "\n");
    uri = us.dwright.IDN_Navbar.ParseURI.parseUri(uri).host.toString().replace(/.*xn--/, '').replace(/\.\w+$/,'');
    //dump("VC_URI PRE decode: " + uri + "\n");
    uri = us.dwright.IDN_Navbar.decode(uri);

    // construct new URL
    uri = protocol + "://" + uri  + '.'  + tld  + relative;
    //dump("VC_URI POST decode: " + uri + "\n");

    // update 'display' value only (does not actually redirect, like location would)
    gURLBar.value = uri;

    // add IDN icon in address bar; indicates that this is an IDN
    var idn_icon     = content.document.createElement("img");
    idn_icon.width   = '16';
    idn_icon.height  = '16';
    //idn_icon.onerror = 'chrome://mozapps/skin/places/defaultFavicon.png'; //untested
    idn_icon.src     = 'chrome://idn_navbar/content/idn-25x14.png';
    idn_icon.setAttribute('onClick', "us.dwright.IDN_Navbar.showAsPunycode()");
    idn_icon.setAttribute('id', 'idn_icon');
    gURLBar.appendChild(idn_icon);

    // TODO:
    //      Tab's display title of page, if no title, url, if IDN, 
    //      then url is punycode - would be nice to show that as IDN too
    // the following is wrong however
    //var tabBox = document.getElementById("tabbox");
    //tabBox.setAttribute('label', 'idn_icon');
    //var tab = document.getElementById("tab");
    //tab.setAttribute('label', 'idn_icon');

    return false;
  },
  // IDN to ascii (Punycode of the IDN)
  showAsPunycode: function() {
    //IDN->Punycode converter idea credit to:
    //http://ecmanaut.blogspot.com/2009/05/resolving-idna-urls-in-browser.html
    var uri = document.getElementById("urlbar").value;
    var hostname = us.dwright.IDN_Navbar.ParseURI.parseUri(uri).host;
    var protocol = us.dwright.IDN_Navbar.ParseURI.parseUri(uri).protocol;

    var a = content.document.createElement("a");
    a.href = protocol + "://" + hostname;

    var idn = protocol + "://" + hostname;
    var punycode = protocol + "://" + a.hostname;
    // TODO need someting better than an alert, ideas?
    alert('IDN:           ' + idn + "\nPunycode: " + punycode);

    return;
  },
  // decode_digit(cp) returns the numeric value of a basic code 
  // point (for use in representing integers) in the range 0 to
  // base-1, or base if cp is does not represent a value.
  decode_digit : function(cp) {
    return  cp - 48 < 10 ? cp - 22 :  cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ?
    cp - 97 : this.base;
  },
  //** Bias adaptation function **
  adapt : function(delta, numpoints, firsttime) {
      var k;
      delta = firsttime ? Math.floor(delta / this.damp) : (delta >> 1);
      delta += Math.floor(delta / numpoints);

      for (k = 0;  delta > (((this.base - this.tmin) * this.tmax) >> 1);  k += this.base) {
              delta = Math.floor(delta / ( this.base - this.tmin ));
      }
      return Math.floor(k + (this.base - this.tmin + 1) * delta / (delta +
      this.skew));
  },
  // Main decode
  // the Punycode conversion decoder courtesy of:
  // http://stackoverflow.com/questions/183485/can-anyone-recommend-a-good-free-javascript-for-punycode-to-unicode-conversion
  // It it based on the C code in RFC 3492. 
  // To use it with domain names you have to remove/add "xn--" from/to the 
  // input/output to/from decode/encode. Javascript UTF16 converter created 
  // by some@domain.name This implementation is released to public domain
  //
  // Title: Punycode Javascript Converter
  // This javascript, is a punycode decoder for non-ASCII characters. 
  // if provides methods to convert between punycode and International Domain Name(IDN).
  decode : function(input,preserveCase) {
      // Dont use uft16
      var output=[];
      var case_flags=[];
      var input_length = input.length;

      var n, out, i, bias, basic, j, ic, oldi, w, k, digit, t, len;

      // Initialize the state: 

      n = this.initial_n;
      i = 0;
      bias = this.initial_bias;

      // Handle the basic code points:  Let basic be the number of input code 
      // points before the last delimiter, or 0 if there is none, then    
      // copy the first basic code points to the output.                      

      basic = input.lastIndexOf(this.delimiter);
      if (basic < 0) basic = 0;

      for (j = 0;  j < basic;  ++j) {
              if(preserveCase) case_flags[output.length] = (input.charCodeAt(j) -65 < 26);
              if (input.charCodeAt(j) >= 0x80) {
                      throw new RangeError("Illegal input >= 0x80");
              }
              output.push( input.charCodeAt(j) );
      }

      // Main decoding loop:  Start just after the last delimiter if any  
      // basic code points were copied; start at the beginning otherwise. 

      for (ic = basic > 0 ? basic + 1 : 0;  ic < input_length; ) {

              // ic is the index of the next character to be consumed,

              // Decode a generalized variable-length integer into delta,  
              // which gets added to i.  The overflow checking is easier   
              // if we increase i as we go, then subtract off its starting 
              // value at the end to obtain delta.
              for (oldi = i, w = 1, k = this.base;  ;  k += this.base) {
                      if (ic >= input_length) {
                              throw RangeError ("punycode_bad_input(1)");
                      }
                      digit = us.dwright.IDN_Navbar.decode_digit(input.charCodeAt(ic++));

                      if (digit >= this.base) {
                              throw RangeError("punycode_bad_input(2)");
                      }
                      if (digit > Math.floor((this.maxint - i) / w)) {
                              throw RangeError ("punycode_overflow(1)");
                      }
                      i += digit * w;
                      t = k <= bias ? this.tmin : k >= bias + this.tmax ? this.tmax : k - bias;
                      if (digit < t) { break; }
                      if (w > Math.floor(this.maxint / (this.base - t))) {
                              throw RangeError("punycode_overflow(2)");
                      }
                      w *= (this.base - t);
              }

              out = output.length + 1;
              bias = us.dwright.IDN_Navbar.adapt(i - oldi, out, oldi === 0);

              // i was supposed to wrap around from out to 0,   
              // incrementing n each time, so we'll fix that now: 
              if ( Math.floor(i / out) > this.maxint - n) {
                      throw RangeError("punycode_overflow(3)");
              }
              n += Math.floor( i / out ) ;
              i %= out;

              // Insert n at position i of the output: 
              // Case of last character determines uppercase flag: 
              if (preserveCase) { case_flags.splice(i, 0, input.charCodeAt(ic -1)  -65 < 26);}

              output.splice(i, 0, n);
              i++;
      }
      if (preserveCase) {
              for (i = 0, len = output.length; i < len; i++) {
                      if (case_flags[i]) {
                              output[i] = (String.fromCharCode(output[i]).toUpperCase()).charCodeAt(0);
                      }
              }
      }
      return us.dwright.IDN_Navbar.utf16.encode(output);            
  }
};

us.dwright.IDN_Navbar.utf16 = {
  decode:function(input){
      var output = [], i=0, len=input.length,value,extra;
      while (i < len) {
              value = input.charCodeAt(i++);
              if ((value & 0xF800) === 0xD800) {
                      extra = input.charCodeAt(i++);
                      if ( ((value & 0xFC00) !== 0xD800) || ((extra & 0xFC00) !== 0xDC00) ) {
                              throw new RangeError("UTF-16(decode): Illegal UTF-16 sequence");
                      }
                      value = ((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
              }
              output.push(value);
      }
      return output;
  },
  encode:function(input){
      var output = [], i=0, len=input.length,value;
      while (i < len) {
              value = input[i++];
              if ( (value & 0xF800) === 0xD800 ) {
                      throw new RangeError("UTF-16(encode): Illegal UTF-16 value");
              }
              if (value > 0xFFFF) {
                      value -= 0x10000;
                      output.push(String.fromCharCode(((value >>>10) & 0x3FF) | 0xD800));
                      value = 0xDC00 | (value & 0x3FF);
              }
              output.push(String.fromCharCode(value));
      }
      return output.join("");
  }
};

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// http://blog.stevenlevithan.com/archives/parseuri
// MIT License
// NOTE: refactored for name spacing

us.dwright.IDN_Navbar.ParseURI = {
  parseUri: function (str) {

    var options = {
      strictMode: false,
      key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
      q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
      },
      parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
      }
    };

    var o   = options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) uri[o.q.name][$1] = $2;
    });
    return uri;
  },
};

window.addEventListener("load", function(e) { us.dwright.IDN_Navbar.onLoad(e); }, false); 
window.addEventListener("unload", function(e) { us.dwright.IDN_Navbar.unLoad(e); }, false); 

