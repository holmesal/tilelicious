import dot from 'dot';

export default dot.template(`
<html>
  <head>
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:site" content="@victoriesco">
	<meta name="twitter:title" content="Victories">
	<meta name="twitter:description" content="Beautiful prints from your Strava data.">
	<meta name="twitter:image" content="http://goo.gl/{{=it.shortlinkId}}">
	<meta name="twitter:image:alt" content="A beautiful print.">

	<meta property="og:url" content="http://prints.victories.co/{{=it.shortlinkId}}">
	<meta property="og:image" content="http://goo.gl/{{=it.shortlinkId}}">
	<meta property="og:image:width" content="1080">
	<meta property="og:image:height" content="1080">
	<meta property="og:title" content="Victories">
	<meta property="og:site_name" content="Victories">
	<meta property="fb:app_id" content="1743873725835324">
	<meta property="og:description" content="Beautiful prints from your Strava data.">
  </head>
  <body>
    <img src="http://goo.gl/{{=it.shortlinkId}}" />
  </body>
</html>
`);