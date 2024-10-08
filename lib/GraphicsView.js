// @flow
import * as AR from './AR';
import invariant from 'invariant';
import React from 'react';
import { AppState, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import GLView from './GLView';

// import AR from '../__tests__/AR.mock';
type Layout = {
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
};

type Props = {
  isArEnabled?: ?boolean,
  isArRunningStateEnabled?: ?boolean,
  arRunningProps?: ?object,
  arCameraProps?: ?object,
  isShadowsEnabled?: ?boolean,
  onShouldReloadContext?: () => boolean,
  onRender: (delta: number) => void,
  onContextCreate?: (props: *) => void,
  onResize?: (layout: Layout) => void,
  shouldIgnoreSafeGuards?: ?boolean,
} & React.ElementProps<typeof GLView>;

export default class GraphicsView extends React.Component<Props> {
  nativeRef: ?GLView.NativeView;
  gl: ?any;

  static defaultProps = {
    arRunningProps: {},
    arCameraProps: {},
    isShadowsEnabled: false,
  };

  state = {
    appState: AppState.currentState,
    id: uuidv4(),
  };

  _renderErrorView = error => (
    <View style={styles.errorContainer}>
      <Text>{error}</Text>
    </View>
  );

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChangeAsync);
  }

  componentWillUnmount() {
    this.destroy();
  }

  destroy = () => {
    this.gl = null;
    this.nativeRef = null;
    cancelAnimationFrame(this.rafID);
  };

  handleAppStateChangeAsync = nextAppState => {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      // console.log('App has come to the foreground!')
      const { onShouldReloadContext } = this.props;
      if (onShouldReloadContext && onShouldReloadContext()) {
        this.destroy();
        this.setState({ appState: nextAppState, id: uuidv4() });
        return;
      }
    }
    this.setState({ appState: nextAppState });
  };

  render() {
    const { isArEnabled, shouldIgnoreSafeGuards, style, glviewStyle } = this.props;

    if (!shouldIgnoreSafeGuards && isArEnabled) {
      return this._renderErrorView(AR.getUnavailabilityReason());
    }

    return (
      <View style={[styles.container, style]}>
        <GLView
          key={this.state.id}
          onLayout={this._onLayout}
          nativeRef_EXPERIMENTAL={this._saveNativeRef}
          style={[styles.container, glviewStyle]}
          onContextCreate={this._onContextCreate}
        />
      </View>
    );
  }

  _saveNativeRef = ref => {
    this.nativeRef = ref;
  };

  _onLayout = ({
    nativeEvent: {
      layout: { x, y, width, height },
    },
  }) => {
    if (!this.gl) {
      return;
    }
    if (this.props.onResize) {
      const scale = PixelRatio.get();
      this.props.onResize({ x, y, width, height, scale, pixelRatio: scale });
    }
  };

  _onContextCreate = async ({ gl, ...props }) => {
    this.gl = gl;

    const { onContextCreate, onRender } = this.props;

    invariant(
      onRender,
      'expo-graphics: GraphicsView.onContextCreate(): `onRender` must be defined.'
    );
    invariant(
      onContextCreate,
      'expo-graphics: GraphicsView.onContextCreate(): `onContextCreate` must be defined.'
    );

    await onContextCreate({
      gl,
      ...props,
    });
    let lastFrameTime;
    const render = () => {
      if (this.gl) {
        const now = 0.001 * getNow();
        const delta = typeof lastFrameTime !== 'undefined' ? now - lastFrameTime : 0.16666;
        this.rafID = requestAnimationFrame(render);

        onRender(delta);
        // NOTE: At the end of each frame, notify `Expo.GLView` with the below
        gl.endFrameEXP();

        lastFrameTime = now;
      }
    };
    render();
  };
}

const getNow = global.nativePerformanceNow || Date.now;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: 'red',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
