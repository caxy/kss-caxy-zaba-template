
/*
Because ::before and ::after aren't actually rendered to the DOM by CSS,
they are not selectable. As this is less than ideal for a styleguide 
that someone might want to pull CSS-provided values from, this function
will append swatch values to a given .swatch element.
*/
var $swatches = $(".kss-swatch");

$swatches.each(renderColorValues);

function renderColorValues() {

  // Get the content found in each swatch's ::before pseudo element
  var colorInfo = window.getComputedStyle(
    this, '::after'
  ).getPropertyValue('content');

  colorInfo = colorInfo.replace(/\"/g,'').replace(/\-/g,' ');
  
  $(this).append(colorInfo);

}