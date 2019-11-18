$( document ).ready(function() {
  let isMobile = $(window).width()<767 ? true : false;
  let aidrPath = 'data/aidr-data.json';//'https://proxy.hxlstandard.org/data.objects.json?strip-headers=on&url=https%3A%2F%2Fdocs.google.com%2Fspreadsheets%2Fd%2F10gm6NsagysRfcUV1i9y7r6vCXzQd9xBf5H-5z5CFrzM%2Fedit%23gid%3D1806654635';
  let acledPath = 'data/acled-education.csv';//'https://proxy.hxlstandard.org/data/acbeef.csv';
  let geomPath = 'data/worldmap.json';
  let coordPath = 'data/coordinates.csv';
  let aidrData, acledData, geomData, coordData = '';

  var formatDate = d3.timeFormat("%Y-%m");
  var numFormat = d3.format(",");
  var shortNumFormat = d3.format(".0s");
  var viewportWidth = window.innerWidth;
  var startDate, endDate;
  var chartPaddingLeft = (isMobile) ? 36 : 94;
  var chartPaddingRight = 40;
  var chartWidth = (isMobile) ? (viewportWidth - chartPaddingLeft) : 896;//viewportWidth*0.7
  var tooltip = d3.select(".tooltip");
  var currentZoom = 1;
  var currentDate = 0;
  var isPlaying = false;

  ////////// slider //////////
  var slider, handle, x, stepTimer;
  function createSlider() {
    var outerpad = aidr.x.step()*aidr.x.paddingOuter();
    var rightPad = chartPaddingRight + outerpad + (aidr.x.bandwidth()/2);
    var leftPad = outerpad/2 + aidr.x.bandwidth()/2;
    var margin = {top: 15, right: rightPad, bottom: 0, left: leftPad},
      width = chartWidth - margin.left - margin.right,
      height = 53 - margin.top - margin.bottom,
      targetValue = width;

    //position slider
    $("#timeSlider").css("top", $('#aidrChart').height()-53);

    var svg = d3.select("#timeSlider")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    //go back one month from startDate
    //use this selection to trigger "All Dates" view
    var temp = new Date(startDate.getFullYear(), startDate.getMonth()-1, startDate.getDate());

    x = d3.scaleTime()
      .domain([temp, endDate])
      .range([0, targetValue])
      .clamp(true);

    slider = svg.append("g")
      .attr("class", "slider")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    slider.append("line")
      .attr("class", "track track-bg")
      .attr("x1", -chartPaddingLeft)
      .attr("x2", width + margin.right - 12)

    slider.append("line")
      .attr("stroke", "#FFF")
      .attr("stroke-width", 1)
      .attr("x1", -chartPaddingLeft)
      .attr("x2", width + margin.right - 10)
      .attr("transform", "translate(0,37)");

    slider.append("line")
      .attr("class", "track")
      .attr("x1", x.range()[0])
      .attr("x2", x.range()[1])
      .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
        .attr("class", "track-overlay")
        .call(d3.drag()
          .on("start.interrupt", function() { slider.interrupt(); })
          .on("end", function() {
            //hack to determine if clicking close to play button
            if (Math.abs(d3.event.x - x(currentDate))<=30 && !isPlaying) {
              stepSlider();
              stepTimer = setInterval(stepSlider, 1000);
            }
            else {
              stopStepSlider();

              //snap slider to closest month
              var value = Math.round(x.invert(d3.event.x));
              updateSlider(closestMonth(new Date(value)), true); 
            }
          })
          .on("drag", function() {
            var value = Math.round(x.invert(d3.event.x));
            updateSlider(value); 
          })
        );
        
    slider.insert("g", ".track-overlay")
      .attr("class", "ticks")
      .attr("transform", "translate(0," + 15 + ")")
      .selectAll("text")
        .data(x.ticks(d3.timeFormat.months, 12))
        .enter()
        .append("text")
        .attr("x", x)
        .attr("y", 8)
        .style("text-anchor", "middle")
        .text(function(d) { return formatDate(d); });

    handle = slider.insert("g", ".track-overlay")
      .attr("transform", "translate(0,0)")
      .attr("class", "handle");

    var bg = handle.append("circle")
      .attr("class", "handle-bg")
      .attr("r", 15);

    var play = handle.append("polygon")
      .attr("class", "handle-play")
      .attr("points", "0 10, 15 19, 0 28")
      .attr("transform", "translate(-5,-18)");

    var pause = handle.append("g")
      .attr("class", "handle-pause");

    pause.insert("line", ".handle-pause")
      .attr("transform", "translate(-3,-7)")
      .attr("y1", 0)
      .attr("y2", 15);

    pause.insert("line", ".handle-pause")
      .attr("transform", "translate(3,-7)")
      .attr("y1", 0)
      .attr("y2", 15);

    //show every other tick for legibility
    var ticks = d3.selectAll(".ticks text");
    ticks.each(function(_,i){
      if (i==0) {
        d3.select(this).text('ALL DATES') //use first tick to trigger show all dates
      }
      if (isMobile && i%2 !== 0) d3.select(this).remove();
    });
  }

  function updateSlider(h, onEnd){
    // update handle position
    handle.attr("transform", "translate("+ x(h) +",0)");

    if (onEnd) {
      if (h.getTime() < startDate.getTime()){
        currentDate = 0;
        resetMap();
      }
      else{
        currentDate = h;
        updateMap(h);
      }
    }
  }

  function stepSlider(){
    var newDate;
    if (currentDate==0 || currentDate.getMonth()+1 <= endDate.getMonth()){
      newDate = (currentDate==0) ? startDate : new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1);      
      $('.handle').addClass('playing');
      updateSlider(newDate, true);
    }
    else {
      stopStepSlider();
    }
  }

  function stopStepSlider(){
    isPlaying = false;
    clearInterval(stepTimer);
    $('.handle').removeClass('playing');
  }

  function createCountryFilter(){
    var countries = [];
    countryList.forEach(function(code){
      coordData.forEach(function(c){
        if (code == c.country_code){
          countries.push({country_code:code, country:c.country});
        }
      });
    });

    countries.sort(function(a, b){
      var x = a.country.toLowerCase();
      var y = b.country.toLowerCase();
      if (x < y) {return -1;}
      if (x > y) {return 1;}
      return 0;
    });

    //create dropdown 
    var dropdown = d3.select(".country-dropdown")
      .selectAll("option")
      .data(countries)
      .enter().append("option")
        .text(function(d) { return d.country; })
        .attr("value", function (d) {
          return d.country_code;
        });

    d3.select(".country-dropdown").on("change",function(e){
      var selected = d3.select(".country-dropdown").node().value;
      drawAidrChart(selected, 750);
      drawAcledChart(selected, 750);
      zoomToCountry(selected);
    });
  }


  function formatAidrData(country_code=""){
    //group the data by date and by lang
    var groups = d3.nest()
      .key(function(d){
        return d['#date+month'];
      })
      .key(function(d){
        return d['#meta+lang'];
      })
      .rollup(function(leaves){
        var total = 0;
        leaves.forEach(function(d) {
          if (country_code=="" || d['#country+code+v_iso2']==country_code)
            total += Number(d['#meta+count']);
        })
        return total;
      })
      .entries(aidrData);

    //flatten the nested data
    var tweetLangData = [];
    groups.forEach(function(d){
      var obj = {"date": d.key};
      var total = 0;
      tweetLangData.columns = [];
      d.values.forEach(function(v){
        obj[v.key] = v.value;
        total += v.value;
        tweetLangData.columns.push(v.key);
      });
      obj["value"] = total;
      tweetLangData.push(obj);
    });

    return tweetLangData;
  }


  function drawAidrChart(country_code="", speed=0) {
    var tweetLangData = formatAidrData(country_code);
    var keys = tweetLangData.columns.sort();
    var max = d3.max(tweetLangData, function(d){ return +d.value; } );
    var median = d3.median(tweetLangData, function(d){ return d.value; }); 
    var barsSvg = d3.select("#aidrChart svg g.bars");
    var svg = d3.select("#aidrChart svg g");
    var numTicks = (max>999) ? 5 : 4;

    //y axis
    max = (max<1) ? 1 : max;
    aidr.y.domain([0, max]).nice();

    svg.selectAll(".y-grid").transition().duration(speed)
      .call(d3.axisRight(aidr.y)
        .tickSize(aidr.width + 30)
        .tickFormat("")
        .ticks(numTicks));

    svg.selectAll(".y-axis").transition().duration(speed)
      .call(d3.axisRight(aidr.y)
        .tickFormat(function(d) { return (max>999) ? shortNumFormat(d) : d; })
        .ticks(numTicks));

    svg.selectAll(".tick")
      .selectAll("text")
        .attr("dy", -8);

    //skip ticks
    if (max>999){
      skipTicks(d3.selectAll("#aidrChart .grid line"));
      skipTicks(d3.selectAll("#aidrChart .y-axis text"));
    }

    var stack = d3.stack()
      .order(d3.stackOrderReverse)
      .offset(d3.stackOffsetNone)
      .keys(keys)(tweetLangData);

    //bars
    var group = barsSvg.selectAll("g.layer")
      .data(stack);

    group.exit().remove();
    group.enter().append("g")
      .classed("layer", true)
      .attr("fill", function(d){ return aidr.z(d.key); });

    var bars = barsSvg.selectAll("g.layer").selectAll("rect")
      .data(function(d) { return d; });

    bars.exit().remove();
    bars.enter().append("rect")
      .attr("class", "bar tweet-bar")
      .merge(bars)
      .on("mouseover", function(){ tooltip.style("opacity", 1); })
      .on("mouseout", function(d) { tooltip.style("opacity", 0); })
      .on("mousemove", function(d) {
        var en = (d.data.en==undefined) ? '0' : numFormat(d.data.en);
        var ar = (d.data.ar==undefined) ? '0' : numFormat(d.data.ar);
        var fr = (d.data.fr==undefined) ? '0' : numFormat(d.data.fr);
        var w = $('.tooltip').outerWidth();
        var h = $('.tooltip-inner').outerHeight() + 20;
        tooltip
          .style("height", h + "px")
          .style("left", (d3.event.pageX - w/2) + "px")
          .style("top", (d3.event.pageY - h - 15) + "px")
          .style("text-align", "left")
          .style("opacity", 1)
          .select("div").html("Arabic: "+ ar + "<br>English: "+ en + "<br>French: "+ fr);
       })
      .transition().duration(speed)
        .attr("x", function(d){ return aidr.x(formatDate(new Date(d.data.date))); })
        .attr("y", function(d){ return aidr.y(d[1]); })
        .attr("width", aidr.x.bandwidth())
        .attr("height", function(d){ 
          var h = (isNaN(d[1])) ? 0 : aidr.y(d[0]) - aidr.y(d[1]);
          return h; 
        });

    //median
    var med = Math.round(median);
    svg.selectAll(".median")
      .transition().duration(speed)
      .attr("y1", aidr.y(med))
      .attr("y2", aidr.y(med));

    svg.selectAll(".median-label")
      .html("Median " + numFormat(med))
      .transition().duration(speed)
      .attr("transform", "translate(" + (aidr.width) + "," + aidr.y(med) + ")");
  }


  var aidr = {};
  function createAidrChart(){
    var tweetLangData = formatAidrData();
    var keys = tweetLangData.columns;
    keys.sort();
    aidr.z = d3.scaleOrdinal().range(["#1ebfb3", "#f2645a", "#9c27b0"]);
    aidr.z.domain(keys);

    var margin = {top: 40, right: chartPaddingRight, bottom: 35, left: chartPaddingLeft},
        width = chartWidth - margin.left - margin.right,
        height = 165 - margin.top - margin.bottom;

    aidr.width = width;

    //chart
    var svg = d3.select("#aidrChart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //x axis
    aidr.x = d3.scaleBand()
      .range([0, width])
      .domain(tweetLangData.map(function(d){ return formatDate(new Date(d.date)); }))
      .padding(0.4);

    //y axis
    aidr.y = d3.scaleLinear()
      .range([ height, 0]);

    svg.append("g")
      .attr("class", "grid y-grid");

    svg.append("g")
      .attr("class", "axis y-axis")
      .attr("transform", "translate("+ width +",0)");

    //bars
    svg.append("g")
      .attr("class", "bars");

    //median
    var line = svg.append("line")
      .attr("class", "median")
      .attr("x1", 0)
      .attr("x2", width-9)

    svg.append("text")
      .attr("x", -9)
      .attr("y", -18)
      .attr("dy", "1em")
      .attr("text-anchor", "end")
      .attr("class", "median-label")

    //legend
    var legend = svg.append("g")
      .attr("transform", "translate(-" + chartPaddingLeft + ",20)")
      .attr("class", "chart-legend")
      .attr("text-anchor", "end")
      .selectAll("g")
      .data(keys)
      .enter().append("g")
        .attr("transform", function(d, i){ return "translate(0," + (i * 16) + ")"; });

    legend.append("rect")
      .attr("x", 44)
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", aidr.z);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 9)
      .attr("class", "label small")
      .attr("dy", "0em")
      .attr("text-anchor", "start")
      .text(function(d) { 
        var lang;
        switch(d) {
          case 'ar':
            lang = 'Arabic';
            break;
          case 'fr':
            lang = 'French'
            break;
          default:
            lang = 'English'
        }
        return lang; 
      });

    //chart title
    svg.append("text")
      .attr("transform", "translate(-" + chartPaddingLeft + ",-20)")
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "label-header")
      .html("Insecurity tweets by language:");

    drawAidrChart();
  }


  //ACLED chart
  function formatAcledData(country_code=""){
    var eventData = d3.nest()
      .key(function(d){ return d.event_date; })
      .rollup(function(leaves){ 
        var total = 0;
        leaves.forEach(function(l){
          if (country_code=="" || l.country_code==country_code)
            total++;
        });
        return total;
      })
      .entries(acledData);
    return eventData;
  }

  function drawAcledChart(country_code="", speed=0){
    var eventData = formatAcledData(country_code);
    var max = d3.max(eventData, function(d){ return +d.value; } );
    var median = d3.median(eventData, function(d){ return d.value; }); 
    var barsSvg = d3.select("#acledChart svg g.bars");
    var svg = d3.select("#acledChart svg g");
    var numTicks = (max>999) ? 5 : 4;

    //y axis
    max = (max<1) ? 1 : max;
    acled.y.domain([0, max]).nice();

    svg.selectAll(".y-grid").transition().duration(speed)
      .call(d3.axisRight(acled.y)
        .tickSize(acled.width + 30)
        .tickFormat("")
        .ticks(numTicks));

    svg.selectAll(".y-axis").transition().duration(speed)
      .call(d3.axisRight(acled.y)
        .tickFormat(function(d) { return (max>999) ? shortNumFormat(d) : d; })
        .ticks(numTicks));

    svg.selectAll(".tick")
      .selectAll("text")
        .attr("dy", 15);

    //skip ticks
    skipTicks(d3.selectAll("#acledChart .grid line"));
    skipTicks(d3.selectAll("#acledChart .y-axis text"));

    var bar = barsSvg.selectAll(".bar")
      .data(eventData);

    bar.exit().remove();
    bar.enter().append("rect")
      .attr("class", "bar event-bar")
      .merge(bar)
      .on("mouseover", function(){ tooltip.style("opacity", 1); })
      .on("mouseout", function(d) { tooltip.style("opacity", 0); })
      .on("mousemove", function(d) {
        var w = $('.tooltip').outerWidth();
        var h = $('.tooltip-inner').outerHeight() + 20;
        tooltip
          .style("height", h + "px")
          .style("left", (d3.event.pageX - w/2) + "px")
          .style("top", (d3.event.pageY - h - 15) + "px")
          .style("text-align", "center")
          .style("opacity", 1)
          .select("div").html("Insecurity events:<br/>" + d.value);
       })
      .transition().duration(speed)
        .attr("x", function(d){ return acled.x(formatDate(new Date(d.key))); })
        .attr("y", function(d){ return acled.y(0); })
        .attr("width", acled.x.bandwidth())
        .attr("height", function(d) { return acled.y(d.value); })
        .attr("fill", "#F7941E");   

    //median
    var med = Math.round(median);
    svg.selectAll(".median")
      .transition().duration(speed)
      .attr("y1", acled.y(med))
      .attr("y2", acled.y(med))

    svg.selectAll(".median-label")
      .html("Median " + numFormat(med))
      .transition().duration(speed)
        .attr("transform", "translate(" + (acled.width) + "," + acled.y(med) + ")")
  }

  var acled = {}
  function createAcledChart(){
    var eventData = formatAcledData();
    var margin = {top: 0, right: chartPaddingRight, bottom: 50, left: chartPaddingLeft},
      width = chartWidth - margin.left - margin.right,
      height = 120 - margin.top - margin.bottom;

    acled.width = width;

    var svg = d3.select("#acledChart")
      .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    //x axis
    acled.x = d3.scaleBand()
      .range([0, width])
      .domain(eventData.map(function(d){ return formatDate(new Date(d.key)); }))
      .padding(0.4);
      svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", "translate(0,0)")
        .call(d3.axisTop(acled.x)
          .tickSizeOuter(0))
        .selectAll("text")
          .style("display", "none");

    //y axis
    acled.y = d3.scaleLinear()
      .range([0, height]);
    
    svg.append("g")
      .attr("class", "grid y-grid");

    svg.append("g")
      .attr("class", "axis y-axis")
      .attr("transform", "translate("+ width +",0)");

    //bars
    svg.append("g")
      .attr("class", "bars");

    //median
    var line = svg.append("line")
      .attr("class", "median")
      .attr("x1", 0)
      .attr("x2", width - 9);

    svg.append("text")
      .attr("x", -9)
      .attr("y", 3)
      .attr("dy", "1em")
      .attr("text-anchor", "end")
      .attr("class", "median-label");

    //chart title
    svg.append("text")
      .attr("transform", "translate(-" + chartPaddingLeft + "," + (height-22) + ")")
      .attr("dy", "1em")
      .attr("text-anchor", "start")
      .attr("class", "label-header")
      .html("Insecurity events");

    //skip ticks for legibility
    var ticks = d3.selectAll("#acledChart .axis text");
    skipTicks(ticks);

    drawAcledChart();
  }

  var mapsvg, mapTooltip, tweetCountryData, eventCountryData, rlog, symbolLog, path;
  var active = d3.select(null);
  function initMap(){
    //group tweet data by country
    tweetCountryData = d3.nest()
      .key(function(d){
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves){
        var total = 0;
        leaves.forEach(function(d) {
          total += Number(d['#meta+count']);
        })
        return total;
      })
      .entries(aidrData);

    //add coord data to grouped data
    for (var i=tweetCountryData.length-1; i>=0; i--){
      if (tweetCountryData[i].key!=''){
        var coords = getCoords(tweetCountryData[i].key);
        tweetCountryData[i].country = coords.country;
        tweetCountryData[i].lat = coords.lat;
        tweetCountryData[i].lon = coords.lon;
      }
      else{
        tweetCountryData.splice(i, 1);
      }
    }

    //group event data by country
    eventCountryData = d3.nest()
      .key(function(d){
        return d.country_code;
      })
      .rollup(function(leaves){
        var total = 0;
        leaves.forEach(function(d) {
          total++;
        })
        return total;
      })
      .entries(acledData);

    drawMap();
  }

  function getCoords(code){
    var coords = {};
    coordData.forEach(function(c){
      if (c.country_code==code){
        coords.country = c.country;
        coords.lat = c.lat;
        coords.lon = c.lon;
      }
    });
    return coords;
  }

  var width, height, zoom, g, projection;
  function drawMap(){
    createMapLegend();

    width = viewportWidth;
    height = (isMobile) ? 400 : ($('.legend-overlay').height() + $('.chart-overlay').height() + 45);
    var mapScale = (isMobile) ? width/1.5 : width/3.5;
    var mapCenter;

    //fix this
    //var mapCenter = (isMobile) ? [17, 0] : [-10, -8];
    if (viewportWidth<767){
      mapCenter = [17, 0];
    }
    else if (viewportWidth>=767 && viewportWidth<=1280){
      mapCenter = [-15, -16];
    }
    else{
      mapCenter = [-10, 0];
    }

    projection = d3.geoMercator()
      .center(mapCenter)
      .scale(mapScale)
      .translate([width / 2, height / 2]);

    zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", zoomed);

    path = d3.geoPath().projection(projection);

    mapsvg = d3.select('#map').append('svg')
      .attr("width", width)
      .attr("height", height)
      .call(zoom)
      .on("wheel.zoom", null)
      .on("dblclick.zoom", null);

    mapsvg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "#191a1a")

    //create log scale for circle markers
    var tweetMax = d3.max(tweetCountryData, function(d){ return +d.value; } );
    rlog = d3.scaleLog()
      .domain([1, tweetMax])
      .range([2, 20]);

    symbolScale = d3.scaleLinear()
      .domain([1, 2,  3,  4,  5,  6,  7,  8])
      .range([75, 20, 10, 5, 3, 2, 1, 1]);
        
    //draw map
    g = mapsvg.append("g");
    g.selectAll("path")
    .data(geomData.features)
    .enter()
      .append("path")
      .attr("class", "map-regions")
      .attr("d", path)
      .on("mouseover", function(d){ 
        var included = false;
        countryList.forEach(function(c){
          if (c==d.properties['ISO_A3']) included = true;
        });
        if (included){
          tooltip.style("opacity", 1); 
        }
      })
      .on("mouseout", function(d) { tooltip.style("opacity", 0); })
      .on("mousemove", function(d) {
        var included = false;
        countryList.forEach(function(c){
          if (c==d.properties['ISO_A3']) included = true;
        });
        if (included){
          createMapTooltip(d.properties['ISO_A3'], d.properties.NAME_LONG);
        }
      });

    //country labels
    g.selectAll(".country-label")
      .data(geomData.features)
      .enter().append("text")
        .attr("class", "country-label")
        .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .text(function(d) { return d.properties.NAME_LONG; });

    //create tweet markers
    var tweetMarker = g.append("g")
      .attr("class", "tweet-layer")
      .selectAll(".tweet-marker")
      .data(tweetCountryData)
      .enter()
        .append("g")
        .append("circle")
        .attr("class", "marker tweet-marker")
        .attr("r", function (d){ return (d.value==0) ? 0 : rlog(d.value); })
        .attr("transform", function(d){ return "translate(" + projection([d.lon, d.lat]) + ")"; })
        .on("mouseover", function(){ tooltip.style("opacity", 1); })
        .on("mouseout", function(){ tooltip.style("opacity", 0); })
        .on("mousemove", function(d) {
          createMapTooltip(d.key, d.country);
        });

    //create event markers
    var eventMarker = g.append("g")
      .attr("class", "event-layer")
      .selectAll(".event-marker")
      .data(acledData)
      .enter()
        .append("g")
        .append("path")
          .attr("class", "marker event-marker")
          .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
          .attr("transform", "scale(1)")
          .attr("transform", function(d){ return "translate(" + projection([d.lon, d.lat]) + ")"; })
          .on("mouseover", function(){ tooltip.style("opacity", 1); })
          .on("mouseout", function(d) { tooltip.style("opacity", 0); })
          .on("mousemove", function(d) {
            createMapTooltip(d.country_code, d.country);
          });

    //tooltip
    mapTooltip = mapsvg.append("g")
      .attr("class", "tooltip");

    //map layers
    d3.select("#aidrLayer").on("change", function(){
      var o = (d3.select(this).property("checked")) ? 1 : 0;
      d3.select(".tweet-layer").style("opacity", o);
    });
    d3.select("#acledLayer").on("change", function(){
      var o = (d3.select(this).property("checked")) ? 1 : 0;
      d3.select(".event-layer").style("opacity", o);
    });

    //zoom controls
    d3.select("#zoom_in").on("click", function() {
      zoom.scaleBy(mapsvg.transition().duration(500), 1.5);
    }); 
    d3.select("#zoom_out").on("click", function() {
      zoom.scaleBy(mapsvg.transition().duration(500), 0.5);
    });
  }

  function createMapTooltip(country_code, country_name){
    var stats = getCountryStats(country_code);
    var w = $('.tooltip').outerWidth();
    var h = $('.tooltip-inner').outerHeight() + 20;
    tooltip.select("div").html("<label class='label-header'>" + country_name + "</label>Tweets: " + stats.tweets + "<br>Events: " + stats.events);
    tooltip
      .style("height", h + "px")
      .style("left", (d3.event.pageX - w/2) + "px")
      .style("top", (d3.event.pageY - h - 15) + "px")
      .style("text-align", "left")
      .style("opacity", 1);
  }

  function zoomed(){
    const {transform} = d3.event;
    currentZoom = transform.k;

    if (!isNaN(transform.k)) {
      g.attr("transform", transform);
      g.attr("stroke-width", 1 / transform.k);

      mapsvg.selectAll(".country-label")
        .style("font-size", function(d) { return 12/transform.k+"px"; });

      updateTweetMarkers(tweetCountryData);

      mapsvg.selectAll(".event-marker")
        .transition().duration(0)
        .attr("d", d3.symbol().type(d3.symbolTriangle).size(symbolScale(transform.k)));
    }
  }

  function clicked(d){
    var offsetX = (isMobile) ? 0 : 50;
    var offsetY = (isMobile) ? 0 : 25;
    const [[x0, y0], [x1, y1]] = path.bounds(d);
    //d3.event.stopPropagation();
    mapsvg.transition().duration(750).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(Math.min(5, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
        .translate(-(x0 + x1) / 2 + offsetX, -(y0 + y1) / 2 - offsetY),
      d3.mouse(mapsvg.node())
    );
  }

  function zoomToCountry(country_code){
    if (country_code==""){ //reset map zoom
      mapsvg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    }
    else{
      geomData.features.forEach(function(c){
        if (c.properties.ISO_A3==country_code){
          clicked(c);
        }
      });
    }
  }

  function getCountryStats(country){
    var obj = {'tweets': 0, 'events': 0};
    tweetCountryData.forEach(function(d){
      if (d.key==country){
        obj.tweets = numFormat(d.value);
      }
    });

    eventCountryData.forEach(function(d){
      if (d.key==country){
        obj.events = d.value;
      }
    });
    return obj;
  }

  function createMapLegend(){
    var tweetMax = d3.max(tweetCountryData, function(d){ return +d.value; } );

    //tweets legend
    d3.select('.map-legend').append('label')
      .text('Number of Insecurity Tweets')
      .append('input')
        .attr('checked', true)
        .attr('type', 'checkbox')
        .attr('id', 'aidrLayer');

    var tweets = d3.select('.map-legend').append('svg')
      .attr('width', 200)
      .attr('height', 80);

    tweets
      .append('circle')
      .attr('class', 'tweet-marker')
      .attr('r', 2)
      .attr('transform', 'translate(10,28)');

    tweets.append('text')
      .attr('class', 'label small')
      .attr('transform', 'translate(7,68)')
      .text('1');

    tweets.append("circle")
      .attr('class', 'tweet-marker')
      .attr('r', 20)
      .attr("transform", "translate(50,28)");

    tweets.append('text')
      .attr('class', 'label small tweet-max')
      .attr('transform', 'translate(42,68)')
      .text(shortNumFormat(tweetMax));

    //events legend
    d3.select('.map-legend').append('label')
      .text('Insecurity Event')
      .append('input')
        .attr('checked', true)
        .attr('type', 'checkbox')
        .attr('id', 'acledLayer');

    var events = d3.select('.map-legend').append('svg')
      .attr('width', 200)
      .attr('height', 25);

    events.append('path')
      .attr('class', 'event-marker')
      .attr("d", d3.symbol().type(d3.symbolTriangle).size(75))
      .attr("transform", "translate(10,18)");
  }

  function updateMap(filterDate){
    //reformat tweet data filtered by date
    tweetCountryData = d3.nest()
      .key(function(d) {
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          if (d['#date+month'].getTime() == filterDate.getTime()) {
            total += Number(d['#meta+count']);
          }
        })
        return total;
      })
      .entries(aidrData);

    //reformat event data filtered by date
    eventCountryData = d3.nest()
      .key(function(d) {
        return d['country_code'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          if (d['event_date'].getTime() == filterDate.getTime()) {
            total++;
          }
        })
        return total;
      })
      .entries(acledData);

    //show bar selections
    d3.selectAll('.tweet-bar').each(function(d){
      var bar = d3.select(this);
      var date = new Date(d.data.date);
      var o = (date.getTime() == filterDate.getTime()) ? 1 : 0.4;
      bar.attr('opacity', o);
    });

    d3.selectAll('.event-bar').each(function(d){
      var bar = d3.select(this);
      var date = new Date(d.key);
      var o = (date.getTime() == filterDate.getTime()) ? 1 : 0.4;
      bar.attr('opacity', o);
    });

    //update map tweet markers
    updateTweetMarkers(tweetCountryData);

    //update map event markers
    mapsvg.selectAll('.event-marker').each(function(m, i){
      var marker = d3.select(this);
      var o = (m.event_date.getTime() == filterDate.getTime()) ? 0.5 : 0;
      marker.style('fill-opacity', o);
    });
  }

  function resetMap() {
    //reformat tweet data filtered by date
    tweetCountryData = d3.nest()
      .key(function(d) {
        return d['#country+code+v_iso2'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d){
          total += Number(d['#meta+count']);
        })
        return total;
      })
      .entries(aidrData);

    //reformat event data filtered by date
    eventCountryData = d3.nest()
      .key(function(d) {
        return d['country_code'];
      })
      .rollup(function(leaves) {
        var total = 0;
        leaves.forEach(function(d) {
          total++;
        })
        return total;
      })
      .entries(acledData);

    //reset bar selections
    d3.selectAll('.tweet-bar').attr('opacity', 1);
    d3.selectAll('.event-bar').attr('opacity', 1);

    //reset map tweet markers
    updateTweetMarkers(tweetCountryData)

    //reset map event markers
    mapsvg.selectAll('.event-marker').style('fill-opacity', 0.5);
  }

  function updateTweetMarkers(tweetCountryData){
    //update log scale for circle markers
    var tweetMax = d3.max(tweetCountryData, function(d){ return +d.value; } );
    rlog = d3.scaleLog()
      .domain([1, tweetMax])
      .range([2, 20]);
    
    //update map legend
    d3.select('.map-legend').select('.tweet-max').text(shortNumFormat(tweetMax));

    //update map tweet markers
    mapsvg.selectAll('circle').each(function(m){
      var marker = d3.select(this);
      tweetCountryData.forEach(function(tweet){
        if (m.key == tweet.key) {
          marker.transition().duration(500).attr('r', function (d) { 
            return (tweet.value==0) ? 0 : (rlog(tweet.value)/currentZoom); 
          })
        }
      });
    });
  }

  function getData() {
    Promise.all([
      d3.csv(coordPath),
      d3.csv(acledPath),
      d3.json(aidrPath),
      d3.json(geomPath)
    ]).then(function(data){
      //parse coord data
      coordData = [];
      data[0].forEach(function(d, i){
        var obj = {
          country: d['Preferred Term'],
          country_code: d['ISO 3166-1 Alpha 3-Codes'],
          lon: d['Longitude'], 
          lat: d['Latitude']
        }
        coordData.push(obj);
      });

      //parse aidr data
      aidrData = data[2];
      aidrData.forEach(function(d){
        var date = d['#date+month'].split('-');
        d['#date+month'] = new Date(date[0], date[1]-1);
      });
      endDate = d3.max(aidrData.map(d=>d['#date+month']));
      startDate = d3.min(aidrData.map(d=>d['#date+month']));

      //parse acled data
      acledData = [];
      data[1] = data[1].reverse();
      data[1].forEach(function(d, i){
        var included = false;
        countryList.forEach(function(c){
          if (c==d.iso3) included = true;
        });
        if (included){
          var split = d.month.split('-');
          var eventDate = new Date(split[0], split[1]-1);
          if (eventDate >= startDate && eventDate <= endDate){
            var obj = {
              event_date: eventDate,
              event_type: d.event_type,
              country: d.country,
              country_code: d.iso3,
              lat: d.latitude,
              lon: d.longitude
            }
            acledData.push(obj);
          }
        }
      });
        
      //parse geom data
      geomData = topojson.feature(data[3], data[3].objects.geom);

      //create vis elements
      createCountryFilter();
      createAidrChart();
      createAcledChart();
      createSlider();
      initMap();

      //set heights
      if (!isMobile) {
        $('.chart-overlay').css('top', $('.legend-overlay').height() + 45);
        $('main').css('height', $('.chart-overlay').height() + $('.legend-overlay').height() + 45);
      }

      //remove loader and show vis
      $('.loader').hide();
      $('main, footer').css('opacity', 1);
    });
  }

  function initTracking() {
    //initialize mixpanel
    let MIXPANEL_TOKEN = window.location.hostname==='data.humdata.org'? '5cbf12bc9984628fb2c55a49daf32e74' : '99035923ee0a67880e6c05ab92b6cbc0';
    mixpanel.init(MIXPANEL_TOKEN);
    mixpanel.track('page view', {
      'page title': document.title,
      'page type': 'datavis'
    });
  }

  getData();
  initTracking();
});