.PHONY: install run html video gif clean

CONFIG ?= config.sample.json

install:
	npm install

# Generates both HTML and video (as configured in $(CONFIG)).
run:
	node bin/cli.js --config $(CONFIG)

html:
	node bin/cli.js --config $(CONFIG) --format html

video:
	node bin/cli.js --config $(CONFIG) --format video

gif:
	node bin/cli.js --config $(CONFIG) --format gif

clean:
	rm -f out.html out.mp4 out.gif
