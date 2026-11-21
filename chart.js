(function () {
  var el = document.getElementById("chart");
  if (!el || !el.getContext) return;
  var ctx = el.getContext("2d");
  ctx.fillStyle = "#1c1c1e";
  ctx.fillRect(0, 0, el.width, el.height);
})();
