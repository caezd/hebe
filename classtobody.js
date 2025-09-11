
var breadcrumbs = document.querySelectorAll('.breadcrumbs')[0];
var body = document.body;

var urlToClass = function (str) {
    var res = /([fc])\d+/.exec(str);
    return `${res[1] == 'f' ? 'forum' : 'category'}-${res[0].substr(1)}`;
};

breadcrumbs.querySelectorAll('a').filter(function (i) {
    return i != 0
}).forEach(function (e) {
    body.classList.add(urlToClass(e.href));
});
