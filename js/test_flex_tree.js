var test_case = {
        "name": "flare",
        "sizing": "node-size-function",
        "gap": "spacing-0"
    },
    engine;
var duration = 750;
var margin = {
        top: 20,
        right: 120,
        bottom: 20,
        left: 120
    },
    width = 960 - margin.right - margin.left,
    height = 800 - margin.top - margin.bottom;
d3.json('flextree.json', function (err, tree) {

    engine = d3.layout.tree().setNodeSizes(true);

    // sizing
    engine.nodeSize(function (t) {
        return [t.x_size, t.y_size];
    });
    // gap
    engine.spacing(function (a, b) {
        return a.parent == b.parent ?
            5 : engine.rootXSize();
    });

    tree.x0 = height / 2;
    tree.y0 = 0;

    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d._children.forEach(collapse);
            d.children = null;
        }
    }
    //tree.children.forEach(collapse);
    // modal event
    var $modal = d3.select('#modal'),
        $modal_cell = $modal.select('.modal-cell'),
        $modal_img = $modal.select('img');
    $modal.on("click.mask", function(){
        $modal.attr('style', 'display: none');
        $modal.select('img').attr('style', 'display: none');
    });
    $modal_img.on("click.img", function(){
        d3.event.stopPropagation();
    });

    var client_width = document.documentElement.clientWidth,
        client_height = document.documentElement.clientHeight;
    var svg = d3.select("#drawing").append('svg').attr("width", client_width).attr("height", client_height);
    var svg_g = svg.append("g");
        //.attr("transform", "translate(" + 20 + "," + client_height/2 + ")");
    svg.call(d3.behavior.zoom().scaleExtent([0.5,3]).on("zoom", redraw));


    update(tree);
    var is_init = 1;
    function update(source){
        // First get the bag of nodes in the right order
        var nodes = d3.layout.hierarchy()(tree);
        // Then get started drawing, including, in the case of flare,
        // the text for each node, which is needed to determine the
        // node sizes, which are used in the layout algorithm.
        var last_id = 0;
        var node = svg_g.selectAll(".node")
            .data(nodes, function (d) {
                return d.id || (d.id = ++last_id);
            });
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                var x_size = source.x_size ? source.x_size : 0;
                return "translate(" + source.y0 + "," + (source.x0 - x_size / 2) + ")";
            })
            .on("click", click);

        // In the case of flare, create the node text now, which is used
        // in the layout.
        if (test_case.name == "flare") {
            var text_elements = nodeEnter.append("text")
                .attr({
                    id: function (d) {
                        return d.id;
                    },
                    fill: 'black',
                    //dx: 5,
                    dy: "0.35em"
                })
                .html(function (d) {
                    var result = parseText(d.content);
                    if(result.type === "img"){
                        d3.select(this.parentNode).attr('img_id', result.img_id).on("click.show", function(){
                            $modal.select('#' + d3.select(this).attr('img_id')).attr("style", "display:inline-block");
                            $modal.attr("style", "display: block");
                        })
                    }
                    return result.content;
                });
            //nodeEnter.html(function(d){
            //    if(/^(\.\/)?img\//.test(d.content)){
            //        return '<text id="'+ d.id +'" xlink:href="' + d.content + '" height="50px" width="50px"/>'
            //    } else {
            //        return '<text id="'+ d.id +'" fill="black" dy="0.35em">'+ parseText(d.content) +'</text>'
            //    }
            //});
            engine.nodeSize(function (d) {
                var ele = document.getElementById(d.id),
                    ele_size = ele.getBBox();
                //ele.setAttribute('dy', (ele_size["width"] + 20)/2);
                return [ele_size["height"] + 30, ele_size["width"] + 14];
            });
        }

        // *Now* do the layout
        nodes = engine.nodes(tree);

        // Get the extents, average node area, etc.
        function node_extents(n) {
            return [n.x - n.x_size / 2, n.y,
                n.x + n.x_size / 2, n.y + n.y_size];
        }

        var root_extents = node_extents(nodes[0]);
        var xmin = root_extents[0],
            ymin = root_extents[1],
            xmax = root_extents[2],
            ymax = root_extents[3],
            area_sum = (xmax - xmin) * (ymax - ymin),
            x_size_min = nodes[0].x_size,
            y_size_min = nodes[0].y_size;

        nodes.slice(1).forEach(function (n) {
            var ne = node_extents(n);
            xmin = Math.min(xmin, ne[0]);
            ymin = Math.min(ymin, ne[1]);
            xmax = Math.max(xmax, ne[2]);
            ymax = Math.max(ymax, ne[3]);
            area_sum += (ne[2] - ne[0]) * (ne[3] - ne[1]);
            x_size_min = Math.min(x_size_min, n.x_size);
            y_size_min = Math.min(y_size_min, n.y_size);
        });
        var area_ave = area_sum / nodes.length;
        // scale such that the average node size is 400 px^2
        //console.log("area_ave = " + area_ave);
        var scale = test_case.name == "flare" ? 1 : 80 / Math.sqrt(area_ave);
        //console.log("extents = %o", {
        //    xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax
        //});
        //console.log("scale = " + scale);

        // Functions to get the derived svg coordinates given the tree node
        // coordinates.
        // Note that the x-y orientations between the svg and the tree drawing
        // are reversed.

        function svg_x(node_y) {
            return (node_y - ymin) * scale;
        }

        function svg_y(node_x) {
            return (node_x - xmin) * scale;
        }


        // FIXME: need to implement these -- the max value should not
        // be scaled.

        // The node box is drawn smaller than the actual node width, to
        // allow room for the diagonal. Note that these are in units of
        // svg drawing coordinates (not tree node coordinates)
        var nodebox_right_margin = Math.min(x_size_min * scale, 10);
        // And smaller than the actual node height, for spacing
        var nodebox_vertical_margin = Math.min(y_size_min * scale, 3);


        function rand() {
            return 80 + Math.floor(Math.random() * 100);
        }

        //var filler = test_case.name != "flare"
        //    ? function () {
        //    return "fill: rgb(" + rand() + "," + rand() + "," + rand() + ")";
        //}
        //    : "fill: none";
        var filler = function () {
            //return "fill: rgb(" + rand() + "," + rand() + "," + rand() + ")";
            return "fill-opacity: 0; stroke:rgb(" + rand() + "," + rand() + "," + rand() + ")"
        };
        // Reposition everything according to the layout
        node.transition()
            .duration(duration)
            .attr("transform", function (d) {
                d.y = d.depth * 180;
                return "translate(" + svg_x(d.y) + "," + (svg_y(d.x)-(d.x_size * scale - nodebox_vertical_margin) / 2) + ")";
            });
        nodeEnter.append("rect")
            //.attr("data-id", function (d) {
            //    return d.id;
            //})
            .attr({
                x: 0,
                //y: function (d) {
                //    return -(d.x_size * scale - nodebox_vertical_margin) / 2;
                //},
                rx: 6,
                ry: 6,
                width: function (d) {
                    return d.y_size * scale - nodebox_right_margin;
                },
                height: function (d) {
                    return d.x_size * scale - nodebox_vertical_margin;
                },
                style: filler
            });
        node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + (source.y) + "," + (svg_y(source.x)-(source.x_size * scale - nodebox_vertical_margin)/2) + ")";
            })
            .remove();

        // This controls the lines between the nodes; see
        // https://github.com/mbostock/d3/wiki/SVG-Shapes#diagonal_projection
        var diagonal = d3.svg.diagonal()
            .source(function (d, i) {
                var s = d.source;
                return {
                    x: s.x,
                    y: s.y + s.y_size - nodebox_right_margin / scale
                };
            })
            .projection(function (d) {
                return [svg_x(d.y), svg_y(d.x)];
            })
            ;
        var test_diagonal = d3.svg.diagonal()
            .source(function (d, i) {
                var s = d.source;
                return {
                    x: s.x,
                    y: s.y + s.y_size - nodebox_right_margin / scale
                };
            })
            .projection(function (d) {
                //return (node_y - ymin) * scale;
                return [d.y, d.x];
            });
        var links = engine.links(nodes);
        var link = svg_g.selectAll("path.link")
            .data(links, function (d) {
                return d.target.id;
            });

        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function (d) {
                var o = {
                    x: source.x0,
                    y: source.y0,
                    y_size: source.y_size
                };
                return test_diagonal({
                    source: o,
                    target: o
                });
            });
        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);
        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                var o = {
                    x: source.x,
                    y: source.y,
                    y_size: d.source.y_size
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();
        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = svg_y(d.x);
            d.y0 = svg_x(d.y);
        });
    }
    i++;
    // Set the svg drawing size and translation

    //svg.attr({
    //    width: (ymax - ymin) * scale,
    //    height: (xmax - xmin) * scale
    //});

//Redraw for zoom
    function redraw() {
        //console.log("here", d3.event.translate, d3.event.scale);
        svg_g.attr("transform",
            "translate(" + d3.event.translate + ")"
            + " scale(" + d3.event.scale + ")");
    }
    // Toggle children on click.
    function click(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }
    function parseText(text){
        var result = {
            type: 'text',
            content: ''
        };
        if(/^(\.\/)?img\//.test(text)){
            result.type = 'img';
            result.img_id = text.replace(/[\/\.]/g, '');
            $modal_cell.append('img').attr('id', result.img_id).attr('src', text).attr('style', 'display:none');
            result.content =  '<tspan x="2" dy="1.5em" path="' + text + '">点击查看图片</tspan>';
        } else {
            var arr = text.match(/.{1,20}/g),
                len = arr.length;
            //var result = '<tspan x="2" dy="1.5em">' + arr[0] + '</tspan>';
            for(var i=0; i<len; i++){
                result.content += '<tspan x="2" dy="1.5em">' + arr[i] + '</tspan>';
            }
        }
        return result;
    }
});
