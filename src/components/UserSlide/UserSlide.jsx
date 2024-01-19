import PropTypes from 'prop-types';

import styles from './UserSlide.module.scss';

export const UserSlide = props => (
  <div className={`${styles.userSlide} ${
    (props.isMaximized ? props.classes?.slideMax : props.classes?.slide) || ''
  }`}
  >{props.slide}
  </div>
);

UserSlide.propTypes = {
  slide: PropTypes.node.isRequired,
  classes: PropTypes.object,
  isMaximized: PropTypes.bool,
};

export const UserSlideThumbnail = props => (
  <div
    className={`${styles.userSlide} ${styles.thumbnail} ${
      (props.isMaximized ? props.classes?.thumbnailSlideMax : props.classes?.thumbnailSlide) || ''
    }`}
    tabIndex="-1"
  >
    {props.slide}
  </div>
);

UserSlideThumbnail.propTypes = {
  slide: PropTypes.node.isRequired,
  isMaximized: PropTypes.bool,
};
