function hxlProxyToJSON(input){
  var output = [];
  var keys=[]
  input.forEach(function(e,i){
    if(i==0){
      e.forEach(function(e2,i2){
        var parts = e2.split('+');
        var key = parts[0]
        if(parts.length>1){
          var atts = parts.splice(1,parts.length);
          atts.sort();                    
          atts.forEach(function(att){
            key +='+'+att
          });
        }
        keys.push(key);
      });
    } else {
      var row = {};
      e.forEach(function(e2,i2){
        row[keys[i2]] = e2;
      });
      output.push(row);
    }
  });
  return output;
}

//find start of week date
function startOfWeek(date) {
  var diff = date.getDate() - date.getDay();
  return new Date(date.setDate(diff)); 
}

//find closest sunday
function closestSunday(d) {
  var prevSun = d.getDate() - d.getDay();
  var nextSun = prevSun + 7;
  var closestSun = (Math.abs(d.getDate() - prevSun) < Math.abs(d.getDate() - nextSun)) ? prevSun : nextSun;
  d.setDate(closestSun);
  d.setHours(0,0,0,0);
  return d;
}

//find closest start of month
function closestMonth(d) {
  var closestMonth = (d.getDate()<15) ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth()+1, 1);
  return closestMonth;
}


//skip every other tick
function skipTicks(ticks) {
  ticks.each(function(_,i){
    if (i%2 !== 0) d3.select(this).remove();
  });
}

//create grid lines in y axis function
function make_y_gridlines() {   
  return d3.axisLeft(y)
    .ticks(5)
}

//wrap svg text
function wrap(text, width) {
  text.each(function() {
    var text = d3.select(this),
        words = text.text().split(/\s+/).reverse(),
        word,
        line = [],
        lineNumber = 0,
        lineHeight = 1.1, // ems
        y = text.attr("y"),
        dy = parseFloat(text.attr("dy")),
        tspan = text.text(null).append("tspan").attr("x", 10).attr("y", y).attr("dy", dy + "em");
    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan").attr("x", 10).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
      }
    }
  });
}

function roundUp(x, limit) {
  return Math.ceil(x/limit)*limit;
}