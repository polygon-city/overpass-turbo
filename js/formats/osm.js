// osm data format module
turbo.formats.osm = {

    var format = {};

    format.match = function( data, meta ) {
        return true; // todo
    };

    format.toGeoJson = function( data ) {
        return; // ...
    };

    
    function _overpassJSON2geoJSON( json ) {
        // sort elements
        var nodes = new Array();
        var ways  = new Array();
        var rels  = new Array();
        for (var i=0;i<json.elements.length;i++) {
            switch (json.elements[i].type) {
                case "node":
                    nodes.push(json.elements[i]);
                break;
                case "way":
                    ways.push(json.elements[i]);
                break;
                case "relation":
                    rels.push(json.elements[i]);
                break;
                default:
                // type=area (from coord-query) is an example for this case.
            }
        }
        return _convert2geoJSON(nodes,ways,rels);
    }
    function _osmXML2geoJSON(xml) {
        // helper function
        function copy_attribute( x, o, attr ) {
            if (x.hasAttribute(attr))
                o[attr] = x.getAttribute(attr);
        }
        // sort elements
        var nodes = new Array();
        var ways  = new Array();
        var rels  = new Array();
        // nodes
        _.each( xml.getElementsByTagName('node'), function( node, i ) {
            var tags = {};
            _.each( node.getElementsByTagName('tag'), function( tag ) {
                tags[tag.getAttribute('k')] = tag.getAttribute('v');
            });
            nodes[i] = {
                'type': 'node'
            };
            copy_attribute( node, nodes[i], 'id' );
            copy_attribute( node, nodes[i], 'lat' );
            copy_attribute( node, nodes[i], 'lon' );
            copy_attribute( node, nodes[i], 'version' );
            copy_attribute( node, nodes[i], 'timestamp' );
            copy_attribute( node, nodes[i], 'changeset' );
            copy_attribute( node, nodes[i], 'uid' );
            copy_attribute( node, nodes[i], 'user' );
            if (!_.isEmpty(tags))
                nodes[i].tags = tags;
        });
        // ways
        _.each( xml.getElementsByTagName('way'), function( way, i ) {
            var tags = {};
            var wnodes = [];
            _.each( way.getElementsByTagName('tag'), function( tag ) {
                tags[tag.getAttribute('k')] = tag.getAttribute('v');
            });
            _.each( node.getElementsByTagName('nd'), function( nd, i ) {
                wnodes[i] = nd.getAttribute('ref');
            });
            ways[i] = {
                "type": "way"
            };
            copy_attribute( way, ways[i], 'id' );
            copy_attribute( way, ways[i], 'version' );
            copy_attribute( way, ways[i], 'timestamp' );
            copy_attribute( way, ways[i], 'changeset' );
            copy_attribute( way, ways[i], 'uid' );
            copy_attribute( way, ways[i], 'user' );
            if (wnodes.length > 0)
                ways[i].nodes = wnodes;
            if (!_.isEmpty(tags))
                ways[i].tags = tags;
        });
        // relations
        _.each( xml.getElementsByTagName('way'), function( relation, i ) {
            var tags = {};
            var members = [];
            _.each( way.getElementsByTagName('tag'), function( relation ) {
                tags[tag.getAttribute('k')] = tag.getAttribute('v');
            });
            _.each( node.getElementsByTagName('member'), function( member, i ) {
                members[i] = {};
                copy_attribute( member, members[i], 'ref' );
                copy_attribute( member, members[i], 'role' );
                copy_attribute( member, members[i], 'type' );
            });
            rels[i] = {
                "type": "relation"
            }
            copy_attribute( relation, rels[i], 'id' );
            copy_attribute( relation, rels[i], 'version' );
            copy_attribute( relation, rels[i], 'timestamp' );
            copy_attribute( relation, rels[i], 'changeset' );
            copy_attribute( relation, rels[i], 'uid' );
            copy_attribute( relation, rels[i], 'user' );
            if (members.length > 0)
                rels[i].members = members;
            if (!_.isEmpty(tags))
                rels[i].tags = tags;
        });
        return _convert2geoJSON(nodes,ways,rels);
    }
    function _convert2geoJSON(nodes,ways,rels) {
        // some data processing (e.g. filter nodes only used for ways)
        var nodeids = new Object();
        for (var i=0;i<nodes.length;i++) {
            if (nodes[i].lat === undefined)
                continue; // ignore nodes without coordinates (e.g. returned by an ids_only query)
            nodeids[nodes[i].id] = nodes[i];
        }
        var poinids = new Object();
        for (var i=0;i<nodes.length;i++) {
            if (typeof nodes[i].tags != 'undefined' &&
                _.any( nodes[i].tags, function(v,k) { return k!="created_by"&&k!="source" } )) // this checks if the node has any tags other than "created_by"
                poinids[nodes[i].id] = true;
        }
        for (var i=0;i<rels.length;i++) {
            if (!_.isArray(rels[i].members))
                continue; // ignore relations without members (e.g. returned by an ids_only query)
            for (var j=0;j<rels[i].members.length;j++) {
                if (rels[i].members[j].type == "node")
                    poinids[rels[i].members[j].ref] = true;
            }
        }
        var wayids = new Object();
        var waynids = new Object();
        for (var i=0;i<ways.length;i++) {
            if (!_.isArray(ways[i].nodes))
                continue; // ignore ways without nodes (e.g. returned by an ids_only query)
            wayids[ways[i].id] = ways[i];
            for (var j=0;j<ways[i].nodes.length;j++) {
                waynids[ways[i].nodes[j]] = true;
                ways[i].nodes[j] = nodeids[ways[i].nodes[j]];
            }
        }
        var pois = new Array();
        for (var i=0;i<nodes.length;i++) {
            if ((!waynids[nodes[i].id]) ||
                    (poinids[nodes[i].id]))
                pois.push(nodes[i]);
        }
        var relids = new Array();
        for (var i=0;i<rels.length;i++) {
            if (!_.isArray(rels[i].members))
                continue; // ignore relations without members (e.g. returned by an ids_only query)
            relids[rels[i].id] = rels[i];
        }
        for (var i=0;i<rels.length;i++) {
            if (!_.isArray(rels[i].members))
                continue; // ignore relations without members (e.g. returned by an ids_only query)
            for (var j=0;j<rels[i].members.length;j++) {
                var m;
                switch (rels[i].members[j].type) {
                    case "node":
                        m = nodeids[rels[i].members[j].ref];
                    break;
                    case "way":
                        m = wayids[rels[i].members[j].ref];
                    break;
                    case "relation":
                        m = relids[rels[i].members[j].ref];
                    break;
                }
                if (m) { // typeof m != "undefined"
                    if (typeof m.relations == "undefined")
                        m.relations = new Array();
                    m.relations.push({
                            "role" : rels[i].members[j].role,
                            "rel" : rels[i].id,
                            "reltags" : rels[i].tags,
                            });
                }
            }
        }
        // construct geojson
        var geojson = new Array();
        var geojsonnodes = {
            "type"     : "FeatureCollection",
            "features" : new Array()
        };
        for ( var i = 0; i < pois.length; i++ ) {
            if (typeof pois[i].lon == "undefined" || typeof pois[i].lat == "undefined")
                continue; // lon and lat are required for showing a point
            var geojsonnode = new turbo.geoJson.PointFeature( 'node', pois[i].id, [+pois[i].lon, +pois[i].lat] );
            geojsonnode.setTags( pois[i].tags || {} );
            geojsonnode.setMeta( _.pick( pois[i], ['timestamp','version','changeset','user','uid'] ) );
            geojsonnode.setRelations( pois[i].relations || [] );
            geojsonnodes.features.push(geojsonnode);
        }
        var geojsonlines = {
            "type"     : "FeatureCollection",
            "features" : new Array()
        };
        var geojsonpolygons = {
            "type"     : "FeatureCollection",
            "features" : new Array()
        };
        // process multipolygons
        for ( var i=0; i < rels.length; i++ ) {
            if ((typeof rels[i].tags != "undefined") &&
                    (rels[i].tags["type"] == "multipolygon" || rels[i].tags["type"] == "boundary")) {
                if (!_.isArray(rels[i].members))
                    continue; // ignore relations without members (e.g. returned by an ids_only query)
                var outer_count = 0;
                _.each(rels[i].members, function(m) {
                    if (wayids[m.ref])
                        wayids[m.ref].is_multipolygon_outline = true;
                });
                for (var j=0;j<rels[i].members.length;j++)
                    if (rels[i].members[j].role == "outer")
                        outer_count++;
                if (outer_count == 0)
                    continue; // ignore multipolygons without outer ways
                var simple_mp = false;
                // simple multipolygons are multipolygons with exactly one (tagged) outer way and an otherwise untagged multipolygon relation
                if (outer_count == 1 &&
                    !_.any( rels[i].tags, function(v,k) { return k!="created_by"&&k!="source"&&k!="type" } )) // this checks if the node has any tags other than "created_by"
                    simple_mp = true;
                if (!simple_mp) {
                    var is_tainted = false;
                    // prepare mp members
                    var members;
                    members = _.filter(rels[i].members, function(m) {return m.type === "way";});
                    members = _.map(members, function(m) {
                        var way = wayids[m.ref];
                        if (way === undefined) { // check for missing ways
                            is_tainted = true;
                            return;
                        }
                        return { // TODO: this is slow! :(
                            id: m.ref,
                            role: m.role || "outer",
                            way: way,
                            nodes: _.filter(way.nodes, function(n) {
                                if (n !== undefined)
                                    return true;
                                is_tainted = true;
                                return false;
                            })
                        };
                    });
                    members = _.compact(members);
                    // construct outer and inner rings
                    var outers, inners;
                    function join(ways) {
                        // stolen from iD/relation.js
                        var joined = [], current, first, last, i, how, what;
                        while (ways.length) {
                            current = ways.pop().nodes.slice();
                            joined.push(current);
                            while (ways.length && _.first(current) !== _.last(current)) {
                                first = _.first(current);
                                last  = _.last(current);
                                for (i = 0; i < ways.length; i++) {
                                    what = ways[i].nodes;
                                    if (last === _.first(what)) {
                                        how  = current.push;
                                        what = what.slice(1);
                                        break;
                                    } else if (last === _.last(what)) {
                                        how  = current.push;
                                        what = what.slice(0, -1).reverse();
                                        break;
                                    } else if (first == _.last(what)) {
                                        how  = current.unshift;
                                        what = what.slice(0, -1);
                                        break;
                                    } else if (first == _.first(what)) {
                                        how  = current.unshift;
                                        what = what.slice(1).reverse();
                                        break;
                                    } else {
                                        what = how = null;
                                    }
                                }
                                if (!what)
                                    break; // Invalid geometry (unclosed ring)
                                ways.splice(i, 1);
                                how.apply(current, what);
                            }
                        }
                        return joined;
                    }
                    outers = join(_.filter(members, function(m) {return m.role==="outer";}));
                    inners = join(_.filter(members, function(m) {return m.role==="inner";}));
                    // sort rings
                    var mp;
                    function findOuter(inner) {
                        var polygonIntersectsPolygon = function(outer, inner) {
                            for (var i=0; i<inner.length; i++)
                                if (pointInPolygon(inner[i], outer))
                                    return true;
                            return false;
                        }
                        var _pluck_latlon = function(from) {
                            return _.map(from, function(n) {
                                if (n === undefined)
                                    return; 
                                return [+n.lat,+n.lon];
                            });
                        }
                        // stolen from iD/geo.js, 
                        // based on https://github.com/substack/point-in-polygon, 
                        // ray-casting algorithm based on http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
                        var pointInPolygon = function(point, polygon) {
                            var x = point[0], y = point[1], inside = false;
                            for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                                var xi = polygon[i][0], yi = polygon[i][1];
                                var xj = polygon[j][0], yj = polygon[j][1];
                                var intersect = ((yi > y) != (yj > y)) &&
                                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                                if (intersect) inside = !inside;
                            }
                            return inside;
                        };
                        // stolen from iD/relation.js
                        var o, outer;
                        inner = _pluck_latlon(inner);
                        /*for (o = 0; o < outers.length; o++) {
                            outer = _pluck(outers[o]);
                            if (polygonContainsPolygon(outer, inner))
                                return o;
                        }*/
                        for (o = 0; o < outers.length; o++) {
                            outer = _pluck_latlon(outers[o]);
                            if (polygonIntersectsPolygon(outer, inner))
                                return o;
                        }
                    }
                    mp = _.map(outers, function(o) {return [o];});
                    for (var j=0; j<inners.length; j++) {
                        var o = findOuter(inners[j]);
                        if (o !== undefined)
                            mp[o].push(inners[j]);
                        else
                            ;//mp.push(inners[j]); // invalid geometry // tyr: why?
                    }
                    // sanitize mp-coordinates (remove empty clusters or rings, {lat,lon,...} to [lon,lat]
                    // TODO: this looks very slow
                    var mp_coords = [];
                    mp_coords = _.compact(_.map(mp, function(cluster) { 
                        var cl = _.compact(_.map(cluster, function(ring) {
                            if (ring === undefined || ring.length <= 1) {
                                is_tainted = true;
                                return;
                            }
                            return _.compact(_.map(ring, function(node) {
                                if (node === undefined || node.lat === undefined) {
                                    is_tainted = true;
                                    return;
                                }
                                return [+node.lon,+node.lat];
                            }));
                        }));
                        if (cl.length == 0) {
                            is_tainted = true;
                            return;
                        }
                        return cl;
                    }));
                    if (mp_coords.length == 0)
                        continue; // ignore multipolygons without coordinates
                    // mp parsed, now construct the geoJSON
                    var geojsonmultipolygon = new turbo.geoJson.MultiPolygonFeature( 'relation', rels[i].id, mp_coords );
                    geojsonmultipolygon.setTags( rels[i].tags || {} );
                    geojsonmultipolygon.setMeta( _.pick( rels[i], ['timestamp','version','changeset','user','uid'] ) );
                    geojsonmultipolygon.setRelations( rels[i].relations || [] );
                    if (is_tainted)
                        geojsonmultipolygon.setFlag("tainted", true);
                    geojsonpolygons.features.push(geojsonmultipolygon);
                } else {
                    // simple multipolygon
                    rels[i].tainted = false;
                    var outer_coords = new Array();
                    var inner_coords = new Array();
                    var outer_way = undefined;
                    for (var j=0;j<rels[i].members.length;j++) {
                        if ((rels[i].members[j].type == "way") &&
                                _.contains(["outer","inner"], rels[i].members[j].role)) {
                            var w = wayids[rels[i].members[j].ref];
                            if (typeof w == "undefined") {
                                rels[i].tainted = true;
                                continue;
                            }
                            var coords = new Array();
                            for (var k=0;k<w.nodes.length;k++) {
                                if (typeof w.nodes[k] == "object")
                                        coords.push([+w.nodes[k].lon, +w.nodes[k].lat]);
                                else
                                    rels[i].tainted = true;
                            }
                            if (rels[i].members[j].role == "outer") {
                                outer_coords.push(coords);
                                w.is_multipolygon = true;
                                outer_way = w;
                            } else if (rels[i].members[j].role == "inner") {
                                inner_coords.push(coords);
                                w.is_multipolygon_inner = true;
                            }
                        }
                    }
                    if (typeof outer_way == "undefined")
                        continue; // abort if outer way object is not present
                    if (outer_coords[0].length == 0)
                        continue; // abort if coordinates of outer way is not present
                    // mp parsed, now construct the geoJSON
                    var geojsonpolygon = new turbo.geoJson.PolygonFeature( 'way', outer_way.id, ([].concat(outer_coords,inner_coords)) );
                    geojsonpolygon.setTags( outer_way.tags || {} );
                    geojsonpolygon.setMeta( _.pick( outer_way, ['timestamp','version','changeset','user','uid'] ) );
                    geojsonpolygon.setRelations( outer_way.relations || [] );
                    if (rels[i].tainted)
                        geojsonpolygon.setFlag("tainted", true);
                    geojsonpolygons.features.push(geojsonpolygon);
                }
            }
        }
        // process lines and polygons
        for (var i=0;i<ways.length;i++) {
            if (!_.isArray(ways[i].nodes))
                continue; // ignore ways without nodes (e.g. returned by an ids_only query)
            if (ways[i].is_multipolygon)
                continue; // ignore ways which are already rendered as multipolygons
            ways[i].tainted = false;
            coords = new Array();
            for (j=0;j<ways[i].nodes.length;j++) {
                if (typeof ways[i].nodes[j] == "object")
                    coords.push([+ways[i].nodes[j].lon, +ways[i].nodes[j].lat]);
                else
                    ways[i].tainted = true;
            }
            if (coords.length <= 1) // invalid way geometry
                continue;
            var way_type = "LineString"; // default
            if (typeof ways[i].nodes[0] != "undefined" && // way has its nodes loaded
                ways[i].nodes[0] === ways[i].nodes[ways[i].nodes.length-1] && // ... and forms a closed ring
                typeof ways[i].tags != "undefined" && // ... and has tags
                turbo.formats.osm.isPolygonFeature(ways[i].tags) // ... and tags say it is a polygon
            ) { // TODO: ^ this.isPolygonFeature ???
                way_type = "Polygon";
                coords = [coords];
            }
            var geojsonfeature;
            if ( way_type == "Polygon" )
                geojsonfeature = new turbo.geoJson.PolygonFeature( 'way', ways[i].id, coords);
            else
                geojsonfeature = new turbo.geoJson.LineStringFeature( 'way', ways[i].id, coords );

            geojsonfeature.setTags( ways[i].tags || {} );
            geojsonfeature.setMeta( _.pick( ways[i], ['timestamp','version','changeset','user','uid'] ) );
            geojsonfeature.setRelations( ways[i].relations || [] );
            if (ways[i].tainted)
                geojsonfeature.setFlag("tainted", true);
            if (ways[i].is_multipolygon_outline)
                geojsonfeature.setFlag('mp_outline', true);
            if (way_type == "LineString")
                geojsonlines.features.push(geojsonfeature);
            else
                geojsonpolygons.features.push(geojsonfeature);
        }

        geojson.push(geojsonpolygons);
        geojson.push(geojsonlines);
        geojson.push(geojsonnodes);
        return geojson;
    }

    return format;
};