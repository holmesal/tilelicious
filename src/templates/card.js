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

  <link rel="shortcut icon" type="image/png" href="http://victories.co/images/favicon.png">

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
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-orient: vertical;
  -webkit-box-direction: normal;
      -ms-flex-direction: column;
          flex-direction: column;
  -webkit-box-align: center;
      -ms-flex-align: center;
          align-items: center;
  min-height: 100%;
  padding-top: 44px;
  padding-bottom: 44px;
}

.image {
  -ms-flex-item-align: stretch;
      align-self: stretch;
  -webkit-box-flex: 1;
      -ms-flex: 1;
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

.buttons {
  display: flex;
  flex-direction: row;
}

.button {
  height: 75px;
  width: 244px;
  border-radius: 4px;
  border-color: #9e9e9e;
  border-style: solid;
  border-width: 1px;
  background-color: transparent;
  color: #202020;
  text-decoration: none;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
      -ms-flex-align: center;
          align-items: center;
  -webkit-box-pack: center;
      -ms-flex-pack: center;
          justify-content: center;
  font-size: 11px;
  letter-spacing: 1.5px;
  margin-left: 20px;
  margin-right: 20px;
}

.green {
  border-style: none;
  background-color: #00CD87;
  color: #FFFFFF;
}
	</style>
  </head>
  <body>
  	<div class="wrapper">
      <div class="image" style="background-image: url('http://goo.gl/{{=it.shortlinkId}}')"></div>
      <div class="buttons">
          <a class="button" href="http://goo.gl/{{=it.shortlinkId}}" download>DOWNLOAD</a>
          <a class="button green" href="http://victories.co">MAKE YOUR OWN</a>
      </div>
    </div>
  </body>
</html>
`);