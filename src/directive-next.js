/**
 * MDN references for hackers:
 * ===========================
 * Media events on <audio> and <video> tags:
 * https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
 * Properties and Methods:
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
 * Internet Exploder version:
 * http://msdn.microsoft.com/en-us/library/ff975061(v=vs.85).aspx
 *
 * Understanding TimeRanges objects:
 * http://html5doctor.com/html5-audio-the-state-of-play/
 */
angular.module('audioPlayer', ['audioPlayer.helpers'])
.constant('playerDefaults', {
  // general properties
  playing: false,
  ended: undefined,
  currentTrack: 0,
  tracks: 0,

  // <audio> properties
  /*
  volume: element[0].volume,
  muted: element[0].muted,
  duration: element[0].duration,
  currentTime: element[0].currentTime,

  // TimeRanges structures
  buffered: element[0].buffered,
  played: element[0].played,
  seekable: element[0].seekable,
  */

  // formatted properties
  formatDuration: '00:00',
  formatTime: '00:00',
  loadPercent: 0
})

.directive('audioPlayer', ['$rootScope', '$interpolate', '$timeout', 'throttle', 'playerDefaults',
  function ($rootScope, $interpolate, $timeout, throttle, playerDefaults) {

    var playerMethods = {
      /**
       * @usage load([audioElement], [autoplayNext]);
       *
       * @param  {audioElement Obj} audioElement a single audioElement, may contain multiple <source>(s)
       * @param  {boolean} autoplayNext: flag to autostart loaded element
       */
      load: function (audioElement, autoplayNext) {
        if (typeof audioElement === 'boolean') {
          autoplayNext = audioElement;
          audioElement = null;
        } else if (typeof audioElement === 'object') {
          this.$clearAudioList();
          this.$addAudioList(audioElement);
        }
        // this.$emit(this.name + ':load', autoplayNext);
        this.$audioEl.load();
        this.ended = undefined;
        if (autoplayNext) {
          var self = this;
          self.$element.bind('canplaythrough', function (evt) {
            self.play();
            self.$element.unbind('canplaythrough');
          });
        }
      },
      /**
       * resets the player (clear the <source>s) and reloads the playlist
       *
       * @usage reset([autoplayNext]);
       * @param  {boolean} autoplayNext: flag to autoplay once resetted
       */
      reset: function (autoplayNext) {
        angular.extend(this, playerDefaults);
        this.$clearAudioList();
        this.load(this.$playlist, autoplayNext);
      },
      /**
       * @usage play([index])
       * @param  {integer} index playlist index (0...n), to start playing from
       */
      play: function (index) {
        if (this.$playlist.length > index) {
          this.currentTrack = index + 1;
          return this.load(this.$playlist[index], true);
        }
        // readyState = HAVE_NOTHING (0) means there's nothing into the <audio> tag
        if (!this.currentTrack && this.$audioEl.readyState) { this.currentTrack++; }

        // In case the stream is completed, reboot it with a load()
        if (this.ended) {
          this.load(true);
        } else {
          this.$audioEl.play();
        }
      },
      playPause: function (index) {
        if (typeof index === 'number' && index + 1 !== this.currentTrack) {
          this.play(index);
        } else if (this.playing) {
          this.pause();
        } else {
          this.play();
        }
      },
      pause: function () {
        this.$audioEl.pause();
      },
      stop: function () {
        this.$audioEl.pause();
        this.$audioEl.currentTime = 0;
      },
      toggleMute: function () {
        this.muted = this.$audioEl.muted = !this.$audioEl.muted;
      },
      next: function (autoplay) {
        var self = this;
        if (self.currentTrack && self.currentTrack < self.tracks) {
          var wasPlaying = autoplay || self.playing;
          self.pause();
          $timeout(function () {
            self.$clearAudioList();
            self.$addAudioList(self._playlist[self.currentTrack]);
            self.load(wasPlaying); // setup autoplay here.
            self.currentTrack++;
          });
        }
      },
      prev: function (autoplay) {
        var self = this;
        if (self.currentTrack && self.currentTrack - 1) {
          var wasPlaying = autoplay || self.playing;
          self.pause();
          $timeout(function () {
            self.$clearAudioList();
            self.$addAudioList(self._playlist[self.currentTrack - 2]);
            self.load(wasPlaying); // setup autoplay here.
            self.currentTrack--;
          });
        }
      },
      $addAudioList: function (audioList) {
        var self = this;
        if (angular.isArray(audioList)) {
          angular.forEach(audioList, function (singleElement, index) {
            var sourceElem = document.createElement('SOURCE');
            angular.forEach(singleElement, function (value, key) {
              sourceElem.setAttribute(key, value);
            });
            self.$element.append(sourceElem);
          });
        } else if (angular.isObject(audioList)) {
          var sourceElem = document.createElement('SOURCE');
          angular.forEach(audioList, function (value, key) { sourceElem.setAttribute(key, value); });
          self.$element.append(sourceElem);
        }
      },
      $clearAudioList: function () {
        this.$element.contents().remove();
      },
      $formatTime: function (seconds) {
        if (seconds === Infinity) {
          return '∞'; // If the data is streaming
        }
        var hours = parseInt(seconds / 3600, 10) % 24,
            minutes = parseInt(seconds / 60, 10) % 60,
            secs = parseInt(seconds % 60, 10),
            result,
            fragment = (minutes < 10 ? '0' + minutes : minutes) + ':' + (secs  < 10 ? '0' + secs : secs);
        if (hours > 0) {
          result = (hours < 10 ? '0' + hours : hours) + ':' + fragment;
        } else {
          result = fragment;
        }
        return result;
      },
      $attachPlaylist: function (pl) {
        if (pl === undefined || pl === null) {
          this.playlist = [];
        } else {
          this.$playlist = pl;
        }
        // unshift first playlist item and put it in the <audio> tag ???
      }
    };

    /**
     * Binding function that gives life to AngularJS scope
     * @param  {Scope}  au       AudioPlayer Scope
     * @param  {jQlite} element  <audio> element
     * @return {function}
     *
     * Returns an unbinding function
     */
    var bindListeners = function (au, element) {
      var listeners = {
        playing: function () {
          au.$apply(function (scope) {
            scope.playing = true;
            scope.ended = false;
          });
        },
        pause: function () {
          au.$apply(function (scope) { scope.playing = false; });
        },
        ended: function () {
          if (au.currentTrack < au.tracks) {
            au.next(true);
          } else {
            au.$apply(function (scope) {
              scope.ended = true;
              scope.playing = false; // IE9 does not throw 'pause' when file ends
            });
          }
        },
        timeupdate: throttle(1000, false, function () {
          au.$apply(function (scope) {
            scope.currentTime = scope.position = scope.$audioEl.currentTime;
            scope.formatTime = scope.$formatTime(scope.currentTime);
          });
        }),
        loadedmetadata: function () {
          au.$apply(function (scope) {
            if (!scope.currentTrack) { scope.currentTrack++; } // This is triggered *ONLY* the first time a <source> gets loaded.
            scope.duration = scope.$audioEl.duration;
            scope.formatDuration = scope.$formatTime(scope.duration);
            scope.loadPercent = parseInt((scope.$audioEl.buffered.end(scope.$audioEl.buffered.length - 1) / scope.duration) * 100, 10);
          });
        },
        progress: function () {
          // WHY THIS?
          if (au.$audioEl.buffered.length) {
            au.$apply(function (scope) {
              scope.loadPercent = parseInt((scope.$audioEl.buffered.end(scope.$audioEl.buffered.length - 1) / scope.duration) * 100, 10);
            });
          }
        }
      };

      angular.forEach(listeners, function (f, listener) {
        element.bind(listener, f);
      });
      return function () {
        angular.forEach(listeners, function (f, listener) {
          element.unbind(listener, f);
        });
      };
    };

    var AudioPlayer = function (element) {
      var audioScope = angular.extend($rootScope.$new(true), {
        $element: element,
        $audioEl: element[0],
        $playlist: undefined,

        // <audio> properties
        /*
        volume: element[0].volume,
        muted: element[0].muted,
        duration: element[0].duration,
        currentTime: element[0].currentTime,

        // TimeRanges structures
        buffered: element[0].buffered,
        played: element[0].played,
        seekable: element[0].seekable,
        */

        // aliases
        // WARNING ALIAS REMOVED!!!
        // position: element[0].currentTime
      }, playerDefaults, playerMethods);
      audioScope.$unbindListeners = bindListeners(audioScope, element);
      return audioScope;
    };

    // creates a watch function bound to the specific player
    // optimizable: closures eats ram
    function playlistWatch(player) {
      return function (playlistNew, playlistOld, watchScope) {
        var currentTrack,
            newTrackNum = null;

        // on every playlist change, it refreshes the reference, safer/shorter approach
        // than using multiple ifs and refresh only if it changed; there's no benefit in that
        player.$attachPlaylist(playlistNew);
        if (playlistNew === undefined && playlistOld !== undefined) {
          return player.pause();
        }

        /**
         * Playlist update logic:
         * If the player has started ->
         *   Check if the playing track is in the new Playlist [EXAMPLE BELOW]
         *   If it is ->
         *     Assign to it the new tracknumber
         *   Else ->
         *     If the new Playlist has some song ->
         *       Pause the player, and get the new Playlist
         *     Else ->
         *       Reset the player, and await for orders
         *
         * Else (if the player hasn't started yet)
         *   Just replace the <src> tags inside the <audio>
         *
         * Example
         * playlist: [a,b,c], playing: c, trackNum: 2
         * ----delay 5 sec-----
         * playlist: [f,a,b,c], playing: c, trackNum: 3
         *
         */
        if (player.currentTrack) {
          currentTrack = playlistOld ? playlistOld[player.currentTrack - 1] : -1;
          for (var i = 0; i < playlistNew.length; i++) {
            if (angular.equals(playlistNew[i], currentTrack)) { newTrackNum = i; break; }
          }
          if (newTrackNum !== null) { // currentTrack it's still in the new playlist, update trackNumber
            player.currentTrack = newTrackNum + 1;
            player.tracks = playlistNew.length;
          } else { // currentTrack has been removed.
            player.pause();
            if (playlistNew.length) { // if the new playlist has some elements, replace actual.
              $timeout(function () { // need $timeout because the audioTag needs a little time to launch the 'pause' event
                player.$clearAudioList();
                player.$addAudioList(playlistNew[0]);
                player.load();
                player.tracks = playlistNew.length;
              });
            } else { // the new playlist has no elements, clear actual
              player.reset();
            }
          }
        } else if (playlistNew.length) { // new playlist has elements, load them
          player.$clearAudioList();
          player.$addAudioList(playlistNew[0]);
          player.load();
          player.tracks = playlistNew.length;
        } else { // new playlist has no elements, clear actual
          player.reset();
        }
      };
    }

    return {
      /**
       * The directive uses the Scope in which gets declared,
       * so it can read/write it with ease.
       * The only isolated Scope here gets created for the AudioPlayer.
       */
      scope: false,
      link: function (scope, element, attrs, ctrl) {
        var playlistName = attrs.playlist,
            audioName = attrs.audioPlayer || attrs.playerControl;

        var player = new AudioPlayer(element), playlist = scope[playlistName];
        // create data-structures in the father Scope
        if (playlistName === undefined) {
          playlist = []; // local playlist gets defined as new
        } else if (scope[playlistName] === undefined) {
          playlist = scope[playlistName] = []; // define playlist on father scope
        } else {
          playlist = scope[playlistName];
        }
        if (audioName !== undefined) { scope[audioName] = player; }

        if (element[0].tagName !== 'AUDIO') {
          return new Error('audioPlayer directive works only when attached to an <audio> type tag');
        }
        var audioElement = [],
            sourceElements = element.find('source');

        // create a single playlist element from <source> tag(s).
        // if the <source> tag is one, use object notation...
        if (sourceElements.length === 1) {
          playlist.unshift({ src: sourceElements[0].src, type: sourceElements[0].type, media: sourceElements[0].media });
        } else if (sourceElements.length > 1) { // otherwise use array notation
          angular.forEach(sourceElements, function (sourceElement) {
            audioElement.push({ src: sourceElement.src, type: sourceElement.type, media: sourceElement.media });
          });
          // put audioElement as first element in the playlist
          playlist.unshift(audioElement);
        }

        /**
         * If the user wants to keep track of the playlist changes
         * has to use data-playlist="variableName" in the <audio> tag
         *
         * Otherwise: it will be created an empty playlist and attached to the player.
         */
        if (playlistName === undefined) {
          player.$attachPlaylist(playlist); // empty playlist case
        } else if (playlist.length) {
          playlistWatch(player)(playlist, undefined, scope); // playlist already populated gets bootstrapped
          scope.$watch(playlistName, playlistWatch(player), true); // then watch gets applied
        } else {
          scope.$watch(playlistName, playlistWatch(player), true); // playlist empty, only watch
        }

        scope.$on('$destroy', player.$destroy);
        element.bind('$destroy', function () { console.log('OMAGAD ELEMENT DEOSTRIYDD'); });
      }
    };

  }]
);
