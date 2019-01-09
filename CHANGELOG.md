### v1.2.1

* Fixed #6. Extension autocompletes weird "class" strings in html, js and css.

### v1.2.0
* Ability to show suggestions from HTML and Slim templates in CSS/SCSS.
  
  You can define class names in HTML and Slim templates and see their results in CSS/SCSS. (vice-cersa).
  Note: If you **save** any html or slim template, cache will be reinitialized. I am thinking to do the same for CSS/SCSS.

### v1.1.0

* Added SCSS/SASS support without compiling whole package.
* Ability to parse custom and magic functions
* Ability to get remote css files such as bootstrap. Remote CSS files will appended to temp dir of your OS.
* Fixed localFiles variable stay in if.
