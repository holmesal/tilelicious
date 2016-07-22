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

	<style>

	*, *:before, *:after
{
	-moz-box-sizing: border-box;
	-webkit-box-sizing: border-box;
	box-sizing: border-box;
}

@import url(https://fonts.googleapis.com/css?family=Poppins:600);


body,html {
  margin: 0;
  background-color: #F2F2F2;
  font-family: 'Poppins', sans-serif;
}

.wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  padding-top: 44px;
  padding-bottom: 44px;
}

.image {
  align-self: stretch;
  flex: 1;
  max-height: 800px;
  min-height: 400px;
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
}

.image {
  height: 100%;
  margin-bottom: 44px;
}

.button {
  height: 75px;
  width: 244px;
  border-radius: 4px;
  background-color: #00CD87;
  text-decoration: none;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 1.5px;
}
	</style>
  </head>
  <body>
  	<div class="wrapper">
  		<div class="image" style="background-image: url('http://goo.gl/{{=it.shortlinkId}}')"></div>
    	<a class="button" href="http://victories.co">MAKE YOUR OWN</a>
    </div>
  </body>
</html>
`);